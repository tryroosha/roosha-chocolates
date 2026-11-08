import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STORE = 'https://fisr1m-va.myshopify.com';
const THEME_ID = 'gid://shopify/OnlineStoreTheme/172025676053';

function loadToken() {
  const config = JSON.parse(
    fs.readFileSync(path.join(os.homedir(), 'Library/Preferences/shopify-cli-kit-nodejs/config.json'), 'utf8')
  );
  const session = JSON.parse(config.sessionStore)['accounts.shopify.com'];
  const preferred = Object.entries(session.applications).find(([key]) => !key.includes('.'));
  return (preferred || Object.entries(session.applications)[0])[1].accessToken;
}

const token = loadToken();
const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
  'X-Shopify-Access-Token': token,
};

async function gql(version, query, variables = {}) {
  const res = await fetch(`${STORE}/admin/api/${version}/graphql.json`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(JSON.stringify(json.errors || json).slice(0, 500));
  }
  return json.data;
}

async function listAll(version, connection, nodeFields) {
  const nodes = [];
  let cursor = null;
  for (;;) {
    const data = await gql(
      version,
      `query ($cursor: String) {
        ${connection}(first: 80, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes { ${nodeFields} }
        }
      }`,
      { cursor }
    );
    const page = data[connection];
    nodes.push(...page.nodes);
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }
  return nodes;
}

async function publishProducts() {
  const products = await listAll('2025-01', 'products', 'id handle onlineStoreUrl');
  const pending = products.filter((product) => !product.onlineStoreUrl);
  console.log(`products ${products.length}, unpublished ${pending.length}`);
  let ok = 0;
  for (const product of pending) {
    const data = await gql(
      '2024-07',
      `mutation ($input: ProductInput!) {
        productUpdate(input: $input) {
          product { onlineStoreUrl }
          userErrors { field message }
        }
      }`,
      { input: { id: product.id, published: true } }
    );
    const errors = data.productUpdate.userErrors;
    if (errors?.length || !data.productUpdate.product?.onlineStoreUrl) {
      console.log('product not published', product.handle, JSON.stringify(errors));
    } else {
      ok += 1;
    }
  }
  console.log(`published products ${ok}`);
}

async function publishCollections() {
  const collections = await listAll('2025-01', 'collections', 'id handle');
  console.log(`collections ${collections.length}`);
  let ok = 0;
  for (const collection of collections) {
    const data = await gql(
      '2024-07',
      `mutation ($input: CollectionInput!) {
        collectionUpdate(input: $input) {
          collection { id }
          userErrors { field message }
        }
      }`,
      { input: { id: collection.id, published: true } }
    );
    const errors = data.collectionUpdate.userErrors;
    if (errors?.length) console.log('collection note', collection.handle, JSON.stringify(errors));
    else ok += 1;
  }
  console.log(`collection updates ${ok}`);
}

async function pushTheme() {
  const files = [
    'templates/index.json',
    'sections/header-group.json',
    'templates/page.faq.json',
    'templates/page.build-your-own.json',
    'templates/page.bulk-order.json',
    'templates/page.chocolate-tasting.json',
    'templates/page.corporate-gifting.json',
    'templates/page.occasions.json',
    'sections/header.liquid',
    'snippets/header-drawer.liquid',
    'snippets/roosha-header-menu.liquid',
    'snippets/roosha-drawer-menu.liquid',
  ].map((filename) => ({
    filename,
    body: {
      type: 'TEXT',
      value: fs.readFileSync(path.join(ROOT, filename), 'utf8'),
    },
  }));
  const data = await gql(
    '2025-01',
    `mutation ($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
      themeFilesUpsert(themeId: $themeId, files: $files) {
        upsertedThemeFiles { filename }
        userErrors { field message }
      }
    }`,
    { themeId: THEME_ID, files }
  );
  console.log('theme', JSON.stringify(data.themeFilesUpsert));
}

await publishProducts();
try {
  await publishCollections();
} catch (error) {
  console.log('collections need the Online Store sales channel in admin:', error.message.slice(0, 180));
}
await pushTheme();
console.log('DONE');
