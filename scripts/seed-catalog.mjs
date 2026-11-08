import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STORE = 'fisr1m-va.myshopify.com';
const API = `https://${STORE}/admin/api/2025-01/graphql.json`;
const CATALOG_PATH = path.join(ROOT, 'data', 'roosha-catalog.json');
const CACHE_PATH = path.join(ROOT, 'scripts', 'image-cache.json');

function loadToken() {
  const config = JSON.parse(
    fs.readFileSync(path.join(os.homedir(), 'Library/Preferences/shopify-cli-kit-nodejs/config.json'), 'utf8')
  );
  const session = JSON.parse(config.sessionStore)['accounts.shopify.com'];
  const apps = session.applications;
  const preferred = Object.entries(apps).find(([k]) => !k.includes('.'));
  return (preferred || Object.entries(apps)[0])[1].accessToken;
}

const token = loadToken();

async function gql(query, variables = {}, attempt = 0) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  const throttled = JSON.stringify(json.errors || '').includes('THROTTLED');
  if (throttled && attempt < 6) {
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    return gql(query, variables, attempt + 1);
  }
  if (!res.ok || json.errors) {
    throw new Error(JSON.stringify({ status: res.status, errors: json.errors, data: json.data }, null, 2));
  }
  return json.data;
}

async function stagedUpload(filePath, mimeType) {
  const filename = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;
  const data = await gql(
    `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }`,
    {
      input: [{ filename, mimeType, resource: 'IMAGE', fileSize: String(fileSize), httpMethod: 'POST' }],
    }
  );
  const target = data.stagedUploadsCreate.stagedTargets[0];
  const form = new FormData();
  for (const p of target.parameters) form.append(p.name, p.value);
  form.append('file', new Blob([fs.readFileSync(filePath)], { type: mimeType }), filename);
  const uploadRes = await fetch(target.url, { method: 'POST', body: form });
  if (!uploadRes.ok) throw new Error(`Upload failed ${uploadRes.status}`);
  return target.resourceUrl;
}

async function uploadAsset(filename) {
  const filePath = path.join(ROOT, 'assets', filename);
  const resourceUrl = await stagedUpload(filePath, 'image/jpeg');
  const data = await gql(
    `mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files { ... on MediaImage { id fileStatus image { url } } }
        userErrors { field message }
      }
    }`,
    { files: [{ originalSource: resourceUrl, alt: `Roosha ${filename}`, contentType: 'IMAGE' }] }
  );
  if (data.fileCreate.userErrors?.length) throw new Error(JSON.stringify(data.fileCreate.userErrors));
  const id = data.fileCreate.files[0].id;
  for (let i = 0; i < 20; i++) {
    const node = await gql(
      `query ($id: ID!) { node(id: $id) { ... on MediaImage { fileStatus image { url } } } }`,
      { id }
    );
    if (node.node?.fileStatus === 'READY') return node.node.image.url;
    if (node.node?.fileStatus === 'FAILED') throw new Error(`File failed ${filename}`);
    await new Promise((r) => setTimeout(r, 1200));
  }
  throw new Error(`File not ready ${filename}`);
}

async function imageMapFor(catalog) {
  const cache = fs.existsSync(CACHE_PATH) ? JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) : {};
  const needed = new Set([
    ...catalog.products.map((p) => p.imageKey),
    ...catalog.collections.map((c) => c.imageKey),
  ]);
  for (const name of needed) {
    if (cache[name]) {
      console.log('image cached', name);
      continue;
    }
    cache[name] = await uploadAsset(name);
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    console.log('uploaded', name);
  }
  return cache;
}

async function findProduct(handle) {
  const data = await gql(
    `query ($q: String!) { products(first: 1, query: $q) { nodes { id handle } } }`,
    { q: `handle:${handle}` }
  );
  return data.products.nodes[0] || null;
}

async function findCollection(handle) {
  const data = await gql(
    `query ($q: String!) { collections(first: 1, query: $q) { nodes { id handle title } } }`,
    { q: `handle:${handle}` }
  );
  return data.collections.nodes[0] || null;
}

async function setVariants(productId, product) {
  const variants = product.variants || [{ price: product.price, options: {} }];
  const current = await gql(
    `query ($id: ID!) {
      product(id: $id) {
        variants(first: 20) { nodes { id } }
      }
    }`,
    { id: productId }
  );
  if (product.options?.length) {
    const optionCreate = await gql(
      `mutation productOptionsCreate($productId: ID!, $options: [OptionCreateInput!]!) {
        productOptionsCreate(productId: $productId, options: $options) {
          userErrors { field message }
        }
      }`,
      {
        productId,
        options: product.options.map((o) => ({
          name: o.name,
          values: o.values.map((v) => ({ name: v })),
        })),
      }
    );
    if (optionCreate.productOptionsCreate.userErrors?.length) {
      console.log('options note', product.handle, optionCreate.productOptionsCreate.userErrors);
    }
  }
  const hasOptions = variants.some((v) => v.options && Object.keys(v.options).length);
  const bulk = await gql(
    `mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!, $strategy: ProductVariantsBulkCreateStrategy) {
      productVariantsBulkCreate(productId: $productId, variants: $variants, strategy: $strategy) {
        productVariants { id }
        userErrors { field message }
      }
    }`,
    {
      productId,
      strategy: 'REMOVE_STANDALONE_VARIANT',
      variants: variants.map((v) => ({
        price: v.price,
        optionValues: hasOptions
          ? Object.entries(v.options).map(([name, value]) => ({ optionName: name, name: value }))
          : undefined,
        inventoryItem: { tracked: false },
        taxable: true,
      })),
    }
  );
  if (bulk.productVariantsBulkCreate.userErrors?.length) {
    console.log('variant note', product.handle, bulk.productVariantsBulkCreate.userErrors);
    const existing = current.product.variants.nodes[0];
    if (existing && variants.length === 1) {
      await gql(
        `mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            userErrors { field message }
          }
        }`,
        { productId, variants: [{ id: existing.id, price: variants[0].price }] }
      );
    }
  }
}

async function upsertProduct(product, imageUrl) {
  const existing = await findProduct(product.handle);
  if (existing) {
    console.log('product exists', product.handle);
    return existing;
  }
  const data = await gql(
    `mutation productCreate($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
      productCreate(product: $product, media: $media) {
        product { id handle title }
        userErrors { field message }
      }
    }`,
    {
      product: {
        title: product.title,
        handle: product.handle,
        descriptionHtml: product.descriptionHtml,
        vendor: 'Roosha',
        productType: product.productType,
        tags: product.tags,
        status: 'ACTIVE',
        seo: product.seo,
      },
      media: imageUrl ? [{ originalSource: imageUrl, alt: product.title, mediaContentType: 'IMAGE' }] : [],
    }
  );
  if (data.productCreate.userErrors?.length) {
    throw new Error(`${product.handle} ${JSON.stringify(data.productCreate.userErrors)}`);
  }
  const created = data.productCreate.product;
  await setVariants(created.id, product);
  console.log('created product', created.handle);
  return created;
}

async function publish(id, publicationId) {
  if (!publicationId) return;
  const data = await gql(
    `mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) { userErrors { field message } }
    }`,
    { id, input: [{ publicationId }] }
  );
  if (data.publishablePublish.userErrors?.length) {
    console.log('publish note', data.publishablePublish.userErrors);
  }
}

async function upsertCollection(col, productIds, imageUrl) {
  let existing = await findCollection(col.handle);
  if (!existing && col.create !== false) {
    const data = await gql(
      `mutation collectionCreate($input: CollectionInput!) {
        collectionCreate(input: $input) {
          collection { id handle title }
          userErrors { field message }
        }
      }`,
      {
        input: {
          title: col.title,
          handle: col.handle,
          descriptionHtml: col.descriptionHtml,
          image: imageUrl ? { src: imageUrl } : undefined,
          seo: col.seo,
        },
      }
    );
    if (data.collectionCreate.userErrors?.length) {
      throw new Error(`${col.handle} ${JSON.stringify(data.collectionCreate.userErrors)}`);
    }
    existing = data.collectionCreate.collection;
    console.log('created collection', existing.handle);
  } else if (existing) {
    console.log('collection exists', col.handle);
  } else {
    console.log('skip missing collection', col.handle);
    return null;
  }
  for (let i = 0; i < productIds.length; i += 40) {
    const chunk = productIds.slice(i, i + 40);
    const added = await gql(
      `mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
        collectionAddProducts(id: $id, productIds: $productIds) {
          userErrors { field message }
        }
      }`,
      { id: existing.id, productIds: chunk }
    );
    if (added.collectionAddProducts.userErrors?.length) {
      console.log('add products note', col.handle, added.collectionAddProducts.userErrors);
    }
  }
  return existing;
}

async function upsertPage(page) {
  const data = await gql(`query { pages(first: 100) { nodes { id handle title } } }`);
  const existing = data.pages.nodes.find((p) => p.handle === page.handle);
  if (existing) {
    console.log('page exists', page.handle);
    return existing;
  }
  const created = await gql(
    `mutation pageCreate($page: PageCreateInput!) {
      pageCreate(page: $page) {
        page { id handle title }
        userErrors { field message }
      }
    }`,
    {
      page: {
        title: page.title,
        handle: page.handle,
        body: page.body,
        isPublished: true,
        templateSuffix: page.templateSuffix || undefined,
      },
    }
  );
  if (created.pageCreate.userErrors?.length) {
    throw new Error(`${page.handle} ${JSON.stringify(created.pageCreate.userErrors)}`);
  }
  console.log('created page', page.handle);
  return created.pageCreate.page;
}

function cleanItem(item) {
  const out = { title: item.title, type: item.type };
  if (item.resourceId) out.resourceId = item.resourceId;
  if (item.url) out.url = item.url;
  if (item.items?.length) out.items = item.items.map(cleanItem);
  return out;
}

function resolveItems(items, collectionsByHandle, productsByHandle, pagesByHandle) {
  return items.map((item) => {
    let resourceId;
    if (item.type === 'COLLECTION') resourceId = collectionsByHandle[item.handle]?.id;
    if (item.type === 'PRODUCT') resourceId = productsByHandle[item.handle]?.id;
    if (item.type === 'PAGE') resourceId = pagesByHandle[item.handle]?.id;
    if (!resourceId && item.type !== 'FRONTPAGE' && item.type !== 'HTTP') {
      console.log('missing menu target', item.title, item.type, item.handle);
    }
    return cleanItem({
      title: item.title,
      type: resourceId ? item.type : 'HTTP',
      resourceId,
      url: resourceId ? undefined : item.url || '/',
      items: item.items ? resolveItems(item.items, collectionsByHandle, productsByHandle, pagesByHandle) : [],
    });
  });
}

async function recreateMenu(handle, title, items) {
  const data = await gql(`query { menus(first: 50) { nodes { id handle } } }`);
  const existing = data.menus.nodes.find((m) => m.handle === handle);
  if (existing) {
    await gql(
      `mutation menuDelete($id: ID!) { menuDelete(id: $id) { deletedMenuId userErrors { message } } }`,
      { id: existing.id }
    );
    console.log('deleted menu', handle);
  }
  const created = await gql(
    `mutation menuCreate($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
      menuCreate(title: $title, handle: $handle, items: $items) {
        menu { id handle }
        userErrors { field message }
      }
    }`,
    { title, handle, items }
  );
  if (created.menuCreate.userErrors?.length) {
    throw new Error(`${handle} ${JSON.stringify(created.menuCreate.userErrors)}`);
  }
  console.log('created menu', handle);
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  const shop = await gql(`{ shop { name primaryDomain { url } } }`);
  console.log('shop', shop.shop);

  let publicationId;
  try {
    const publications = await gql(`{ publications(first: 10) { nodes { id name } } }`);
    const online = publications.publications.nodes.find((p) => /online store/i.test(p.name));
    publicationId = online?.id;
    console.log('publication', online?.name || 'none');
  } catch (err) {
    console.log('publish scope unavailable, products stay on the default channel');
  }

  const images = await imageMapFor(catalog);
  const productsByHandle = {};
  for (const product of catalog.products) {
    const created = await upsertProduct(product, images[product.imageKey]);
    productsByHandle[product.handle] = created;
    await publish(created.id, publicationId);
  }

  const collectionsByHandle = {};
  for (const col of catalog.collections) {
    const ids = catalog.products
      .filter((p) => p.collections.includes(col.handle))
      .map((p) => productsByHandle[p.handle]?.id)
      .filter(Boolean);
    const created = await upsertCollection(col, ids, images[col.imageKey]);
    if (created) {
      collectionsByHandle[col.handle] = created;
      await publish(created.id, publicationId);
    }
  }

  const pagesByHandle = {};
  const existingPages = await gql(`query { pages(first: 100) { nodes { id handle title } } }`);
  for (const page of existingPages.pages.nodes) pagesByHandle[page.handle] = page;
  for (const page of catalog.pages) {
    pagesByHandle[page.handle] = await upsertPage(page);
  }

  const mainItems = resolveItems(catalog.navigation.main, collectionsByHandle, productsByHandle, pagesByHandle);
  const footerItems = resolveItems(catalog.navigation.footerShop, collectionsByHandle, productsByHandle, pagesByHandle);
  const helpItems = resolveItems(catalog.navigation.help, collectionsByHandle, productsByHandle, pagesByHandle).filter(
    (item) => item.resourceId || item.type === 'HTTP'
  );

  await recreateMenu('main-menu', 'Main menu', mainItems);
  await recreateMenu('footer', 'Footer', [...footerItems, ...helpItems]);
  await recreateMenu('footer-shop', 'Footer Shop', footerItems);
  await recreateMenu('help', 'Help', helpItems);

  const summary = {
    shop: shop.shop,
    productCount: Object.keys(productsByHandle).length,
    collectionCount: Object.keys(collectionsByHandle).length,
    collections: Object.fromEntries(
      Object.entries(collectionsByHandle).map(([handle, col]) => [handle, { id: col.id, title: col.title }])
    ),
  };
  fs.writeFileSync(path.join(ROOT, 'scripts', 'catalog-seed-result.json'), JSON.stringify(summary, null, 2));
  console.log('DONE', summary.productCount, 'products', summary.collectionCount, 'collections');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
