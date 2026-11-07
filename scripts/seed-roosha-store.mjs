import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STORE = 'fisr1m-va.myshopify.com';
const API = `https://${STORE}/admin/api/2025-01/graphql.json`;

function loadToken() {
  const config = JSON.parse(
    fs.readFileSync(path.join(os.homedir(), 'Library/Preferences/shopify-cli-kit-nodejs/config.json'), 'utf8')
  );
  const session = JSON.parse(config.sessionStore)['accounts.shopify.com'];
  const apps = session.applications;
  const preferred = Object.entries(apps).find(([k]) => !k.includes('.'));
  const token = (preferred || Object.entries(apps)[0])[1].accessToken;
  return token;
}

const token = loadToken();

async function gql(query, variables = {}) {
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
        stagedTargets {
          url
          resourceUrl
          parameters { name value }
        }
        userErrors { field message }
      }
    }`,
    {
      input: [
        {
          filename,
          mimeType,
          resource: 'IMAGE',
          fileSize: String(fileSize),
          httpMethod: 'POST',
        },
      ],
    }
  );
  const target = data.stagedUploadsCreate.stagedTargets[0];
  if (!target) throw new Error('No staged upload target');
  const form = new FormData();
  for (const p of target.parameters) form.append(p.name, p.value);
  form.append('file', new Blob([fs.readFileSync(filePath)], { type: mimeType }), filename);
  const uploadRes = await fetch(target.url, { method: 'POST', body: form });
  if (!uploadRes.ok) {
    throw new Error(`Upload failed ${uploadRes.status}: ${await uploadRes.text()}`);
  }
  return target.resourceUrl;
}

async function createFileFromStaged(resourceUrl, alt) {
  const data = await gql(
    `mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          ... on MediaImage {
            id
            alt
            image { url }
            fileStatus
          }
        }
        userErrors { field message }
      }
    }`,
    {
      files: [
        {
          originalSource: resourceUrl,
          alt,
          contentType: 'IMAGE',
        },
      ],
    }
  );
  if (data.fileCreate.userErrors?.length) {
    throw new Error(JSON.stringify(data.fileCreate.userErrors));
  }
  return data.fileCreate.files[0];
}

async function waitForFileReady(fileId, attempts = 20) {
  for (let i = 0; i < attempts; i++) {
    const data = await gql(
      `query ($id: ID!) {
        node(id: $id) {
          ... on MediaImage {
            id
            fileStatus
            image { url }
          }
        }
      }`,
      { id: fileId }
    );
    const status = data.node?.fileStatus;
    if (status === 'READY') return data.node;
    if (status === 'FAILED') throw new Error(`File failed ${fileId}`);
    await new Promise((r) => setTimeout(r, 1200));
  }
  throw new Error(`File not ready ${fileId}`);
}

async function findProductByHandle(handle) {
  const data = await gql(
    `query ($q: String!) {
      products(first: 1, query: $q) {
        nodes { id handle title }
      }
    }`,
    { q: `handle:${handle}` }
  );
  return data.products.nodes[0] || null;
}

async function findCollectionByHandle(handle) {
  const data = await gql(
    `query ($q: String!) {
      collections(first: 1, query: $q) {
        nodes { id handle title }
      }
    }`,
    { q: `handle:${handle}` }
  );
  return data.collections.nodes[0] || null;
}

async function findPageByHandle(handle) {
  const data = await gql(
    `query {
      pages(first: 100) {
        nodes { id handle title }
      }
    }`
  );
  return data.pages.nodes.find((p) => p.handle === handle) || null;
}

async function upsertProduct(product) {
  const existing = await findProductByHandle(product.handle);
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
      media: product.media || [],
    }
  );
  if (data.productCreate.userErrors?.length) {
    throw new Error(JSON.stringify(data.productCreate.userErrors));
  }
  const created = data.productCreate.product;
  console.log('created product', created.handle);

  if (product.variants?.length) {
    await setVariants(created.id, product.variants, product.options);
  }
  return created;
}

async function setVariants(productId, variants, options) {
  // Fetch current variants
  const current = await gql(
    `query ($id: ID!) {
      product(id: $id) {
        options { id name values }
        variants(first: 50) {
          nodes { id title }
        }
      }
    }`,
    { id: productId }
  );

  if (options?.length) {
    const optionCreate = await gql(
      `mutation productOptionsCreate($productId: ID!, $options: [OptionCreateInput!]!) {
        productOptionsCreate(productId: $productId, options: $options) {
          product { id }
          userErrors { field message }
        }
      }`,
      {
        productId,
        options: options.map((o) => ({
          name: o.name,
          values: o.values.map((v) => ({ name: v })),
        })),
      }
    );
    if (optionCreate.productOptionsCreate.userErrors?.length) {
      // Options may already exist after create with variants strategy
      console.log('options note', optionCreate.productOptionsCreate.userErrors);
    }
  }

  // Use productVariantsBulkCreate / update strategy:
  // Delete default if replacing, then bulk create.
  const existingVariants = current.product.variants.nodes;
  const bulk = await gql(
    `mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!, $strategy: ProductVariantsBulkCreateStrategy) {
      productVariantsBulkCreate(productId: $productId, variants: $variants, strategy: $strategy) {
        productVariants { id title price }
        userErrors { field message }
      }
    }`,
    {
      productId,
      strategy: 'REMOVE_STANDALONE_VARIANT',
      variants: variants.map((v) => ({
        price: v.price,
        optionValues: Object.entries(v.options).map(([name, value]) => ({ optionName: name, name: value })),
        inventoryItem: { tracked: false },
        taxable: true,
      })),
    }
  );
  if (bulk.productVariantsBulkCreate.userErrors?.length) {
    console.log('variant errors', bulk.productVariantsBulkCreate.userErrors);
    // Fallback: update the single default variant price/title when only one
    if (variants.length === 1 && existingVariants[0]) {
      await gql(
        `mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants { id }
            userErrors { field message }
          }
        }`,
        {
          productId,
          variants: [{ id: existingVariants[0].id, price: variants[0].price }],
        }
      );
    }
  } else {
    console.log('variants set', variants.length);
  }
}

async function upsertCollection(col) {
  const existing = await findCollectionByHandle(col.handle);
  if (existing) {
    console.log('collection exists', col.handle);
    return existing;
  }
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
        image: col.image ? { src: col.image } : undefined,
        products: col.productIds,
        seo: col.seo,
      },
    }
  );
  if (data.collectionCreate.userErrors?.length) {
    throw new Error(JSON.stringify(data.collectionCreate.userErrors));
  }
  console.log('created collection', data.collectionCreate.collection.handle);
  return data.collectionCreate.collection;
}

async function upsertPage(page) {
  const existing = await findPageByHandle(page.handle);
  if (existing) {
    await gql(
      `mutation pageUpdate($id: ID!, $page: PageUpdateInput!) {
        pageUpdate(id: $id, page: $page) {
          page { id handle }
          userErrors { field message }
        }
      }`,
      {
        id: existing.id,
        page: {
          title: page.title,
          body: page.body,
          isPublished: true,
        },
      }
    );
    console.log('updated page', page.handle);
    return existing;
  }
  const data = await gql(
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
      },
    }
  );
  if (data.pageCreate.userErrors?.length) {
    throw new Error(JSON.stringify(data.pageCreate.userErrors));
  }
  console.log('created page', data.pageCreate.page.handle);
  return data.pageCreate.page;
}

async function ensureMenu(handle, title, items) {
  const data = await gql(`query { menus(first: 50) { nodes { id handle title } } }`);
  const existing = data.menus.nodes.find((m) => m.handle === handle);
  const itemInputs = items.map((item) => ({
    title: item.title,
    type: item.type,
    resourceId: item.resourceId,
    url: item.url,
    items: item.items || [],
  }));

  if (existing) {
    await gql(
      `mutation menuUpdate($id: ID!, $title: String!, $items: [MenuItemUpdateInput!]!) {
        menuUpdate(id: $id, title: $title, items: $items) {
          menu { id handle }
          userErrors { field message }
        }
      }`,
      { id: existing.id, title, items: itemInputs.map(({ title: t, type, resourceId, url, items: nested }) => ({
        title: t,
        type,
        resourceId,
        url,
        items: nested,
      })) }
    );
    // menuUpdate item shape differs; fall back to delete+create if needed
    console.log('menu update attempted', handle);
    return existing;
  }

  const created = await gql(
    `mutation menuCreate($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
      menuCreate(title: $title, handle: $handle, items: $items) {
        menu { id handle }
        userErrors { field message }
      }
    }`,
    { title, handle, items: itemInputs }
  );
  if (created.menuCreate.userErrors?.length) {
    throw new Error(JSON.stringify(created.menuCreate.userErrors));
  }
  console.log('created menu', handle);
  return created.menuCreate.menu;
}

const pages = {
  shipping: {
    title: 'Shipping and Delivery Policy',
    handle: 'shipping-delivery-policy',
    body: `<h1>Shipping &amp; Delivery Policy</h1>
<p>We ensure careful packing and timely delivery of your Roosha chocolates across India.</p>
<h3>1. Order Processing</h3>
<ul>
<li>Orders are processed within 1–2 business days.</li>
<li>Orders placed on weekends or public holidays are processed on the next working day.</li>
</ul>
<h3>2. Delivery Time</h3>
<ul>
<li>Most orders across India: 3–7 business days after dispatch.</li>
<li>Metro cities typically: 2–5 business days after dispatch.</li>
<li>Other locations typically: 4–9 business days after dispatch.</li>
<li>Delivery timelines are estimates and may vary due to courier partners, weather, or high order volume.</li>
</ul>
<h3>3. Shipping Charges</h3>
<ul>
<li>Free shipping on prepaid orders above ₹499.</li>
<li>Standard shipping charges apply below this amount and are shown at checkout.</li>
<li>Cash on Delivery is currently not available.</li>
</ul>
<h3>4. Order Tracking</h3>
<ul>
<li>Tracking details are shared by SMS and email once your order has been shipped.</li>
<li>For faster help, message us on WhatsApp with the mobile number used on your order.</li>
</ul>
<h3>5. Delays</h3>
<p>Delivery may be delayed due to weather conditions, courier issues, or high order volume.</p>
<h3>6. Undelivered Orders</h3>
<p>If delivery fails due to an incorrect address or customer unavailability, re-shipping charges may apply.</p>
<h3>7. Chocolate Care</h3>
<p>Chocolates are perishable and temperature-sensitive. We pack every order carefully, but once handed to the courier partner, transit conditions are outside our direct control.</p>
<h3>8. Contact</h3>
<p>Email: hello@tryroosha.com<br>WhatsApp / Customer Care: +91 77778 77253</p>`,
  },
  returns: {
    title: 'Returns and Refunds Policy',
    handle: 'return-refund-exchange-policy',
    body: `<h1>Return, Refund &amp; Exchange Policy</h1>
<p>Last updated: November 2026</p>
<p>At Roosha, we want you to shop with confidence. Please review this policy before requesting a return or exchange.</p>
<h2>1. Return Eligibility</h2>
<p>We accept return requests within 3 days of delivery for eligible ready-to-ship products.</p>
<p>To be eligible, the product must:</p>
<ul>
<li>Be unused and in its original condition.</li>
<li>Include all original packaging and accessories.</li>
<li>Show no signs of melting, opening, tasting, or damage caused after delivery.</li>
</ul>
<h2>2. How to Request a Return</h2>
<ol>
<li>Contact us on WhatsApp within 3 days of receiving your order.</li>
<li>Share your Order ID and the reason for the return or exchange.</li>
<li>Our team will review your request and guide you through the next steps.</li>
</ol>
<p>Please do not send any product back without confirmation from our support team.</p>
<h2>3. Exchanges</h2>
<ul>
<li>Damaged, defective, or incorrect items may be exchanged or replaced after verification.</li>
<li>Exchanges for another product are subject to availability, with any price difference adjusted accordingly.</li>
</ul>
<h2>4. Damaged or Incorrect Products</h2>
<p>If you receive a damaged, melted, defective, or incorrect item, contact us within 24 hours of delivery with clear photographs and, if possible, an unboxing video. Once verified, we will arrange a suitable resolution.</p>
<h2>5. Refunds</h2>
<ul>
<li>Approved refunds are processed within 5–10 business days to the original payment method.</li>
<li>We currently accept prepaid orders only.</li>
</ul>
<h2>6. Shipping Charges</h2>
<p>For change-of-mind returns, original shipping charges (if any) may be deducted. No shipping charges are deducted for approved exchanges. If the issue is our error, you will receive a full refund or replacement without shipping deductions.</p>
<h2>7. Non-Returnable Items</h2>
<ul>
<li>Customised, personalised, festive-message, wedding, or corporate orders made to request.</li>
<li>Opened, tasted, melted, or temperature-compromised chocolates after delivery acceptance.</li>
<li>Clearance items marked as non-returnable.</li>
</ul>
<h2>8. Contact</h2>
<p>WhatsApp: +91 77778 77253<br>Email: hello@tryroosha.com</p>`,
  },
  privacy: {
    title: 'Privacy Policy',
    handle: 'privacy-policy',
    body: `<h1>Privacy Policy</h1>
<p>Last updated: November 2026</p>
<p>At Roosha, we value your trust and are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your personal information when you visit our website, make a purchase, or interact with our services.</p>
<h2>1. Information We Collect</h2>
<ul>
<li>Contact details such as name, email address, phone number, and shipping address.</li>
<li>Order information including products purchased, order history, cart details, and customisation requests.</li>
<li>Payment confirmation details processed securely by our payment partners. We do not store full card or banking details.</li>
<li>Website usage data such as device information, pages visited, and interactions used to improve our store.</li>
</ul>
<h2>2. How We Use Your Information</h2>
<ul>
<li>Process and fulfil orders.</li>
<li>Deliver products and share shipping updates.</li>
<li>Respond to custom-order, wedding, and corporate gifting enquiries.</li>
<li>Provide customer support and process refunds where applicable.</li>
<li>Improve our website and shopping experience.</li>
<li>Prevent fraud and comply with legal obligations.</li>
<li>Send promotional updates only where permitted or with your consent.</li>
</ul>
<h2>3. Sharing Your Information</h2>
<p>We share information only when necessary to operate our business, including with Shopify, secure payment partners, courier partners, analytics providers, and customer support tools. We never sell, rent, or trade your personal information.</p>
<h2>4. Data Retention &amp; Security</h2>
<p>We retain personal information only as long as needed for orders, support, legal, and tax obligations. We use appropriate safeguards to protect your information, though no online transmission is completely secure.</p>
<h2>5. Your Rights</h2>
<p>Subject to applicable law, you may request access, correction, update, deletion, or withdrawal of consent for promotional communication by contacting us.</p>
<h2>6. Contact</h2>
<p>Email: hello@tryroosha.com<br>WhatsApp: +91 77778 77253<br>Website: tryroosha.com</p>`,
  },
  terms: {
    title: 'Terms and Conditions',
    handle: 'terms-and-conditions',
    body: `<h1>Terms &amp; Conditions</h1>
<p>Last updated: November 2026</p>
<p>Welcome to Roosha. By accessing our website or placing an order, you agree to these Terms &amp; Conditions.</p>
<h2>1. General</h2>
<ul>
<li>This website is owned and operated by Roosha.</li>
<li>We may update these Terms at any time by posting changes on this page.</li>
</ul>
<h2>2. Products &amp; Pricing</h2>
<ul>
<li>We strive to display accurate descriptions, images, and prices.</li>
<li>Chocolate colour, sheen, and filling appearance may vary slightly due to photography, lighting, and craft variations.</li>
<li>All prices are listed in Indian Rupees (INR) and may change without prior notice.</li>
<li>Products marked for enquiry or customisation require confirmation before payment is finalised.</li>
<li>In the event of a pricing or product information error, we may cancel the order and issue a full refund.</li>
</ul>
<h2>3. Orders &amp; Payments</h2>
<ul>
<li>All orders are subject to acceptance and availability.</li>
<li>We may refuse or cancel an order due to unavailability, payment issues, suspected fraud, or incorrect pricing.</li>
<li>Payments are processed securely through trusted payment partners.</li>
</ul>
<h2>4. Shipping &amp; Delivery</h2>
<p>Orders are processed and shipped as per our Shipping Policy. Delivery timelines are estimates and may vary.</p>
<h2>5. Returns &amp; Refunds</h2>
<p>Returns, exchanges, and refunds are governed by our Return &amp; Refund Policy.</p>
<h2>6. Custom &amp; Bulk Orders</h2>
<p>Custom bars, festive messages, wedding favours, and corporate gifts may require approval, lead time, and advance confirmation. Quoted prices are valid only for the specifications discussed.</p>
<h2>7. Intellectual Property</h2>
<p>All website content, including imagery, branding, and text, belongs to Roosha and may not be used without written permission.</p>
<h2>8. Governing Law</h2>
<p>These Terms are governed by the laws of India.</p>
<h2>9. Contact</h2>
<p>Email: hello@tryroosha.com<br>Customer Care: +91 77778 77253</p>`,
  },
  about: {
    title: 'Our Story',
    handle: 'our-story',
    body: `<h1>Our Story</h1>
<p>At Roosha, we believe chocolate is more than a treat. It is a way to celebrate, connect, and create memories. From indulgent chocolate bars to carefully curated gifts, every creation is designed to make ordinary moments feel extraordinary.</p>
<p>Based in Himachal Pradesh, Roosha is a premium chocolate and curated gifting brand for everyday craving, festive celebration, weddings, and thoughtful corporate gestures.</p>
<p>We focus on refined flavours, beautiful presentation, and personalisation that feels considered — whether you are choosing a mini bar for return gifts or designing a filled bar for someone you love.</p>`,
  },
  contact: {
    title: 'Contact Us',
    handle: 'contact',
    body: `<h1>Contact Us</h1>
<p>We would love to hear from you — whether you need help with an order, a custom flavour request, or a wedding and corporate gifting enquiry.</p>
<p><strong>Email:</strong> hello@tryroosha.com<br>
<strong>WhatsApp / Customer Care:</strong> +91 77778 77253<br>
<strong>Based in:</strong> Himachal Pradesh, India</p>`,
  },
  custom: {
    title: 'Custom Chocolate Studio',
    handle: 'custom-chocolate-studio',
    body: `<h1>Custom Chocolate Studio</h1>
<p>Design chocolate bars around your moment. Choose size, filling, dried-fruit options, festive messages, wedding names, and special packaging. If your combination is not listed, send an enquiry and our team will guide you.</p>`,
  },
  wedding: {
    title: 'Wedding & Corporate Gifting',
    handle: 'wedding-corporate-gifting',
    body: `<h1>Wedding &amp; Corporate Gifting</h1>
<p>From wedding favours and personalized gift boxes to corporate hampers and bulk chocolate orders, Roosha creates premium gifting with burgundy-and-gold presentation and thoughtful personalisation.</p>`,
  },
};

const productDefs = [
  {
    title: 'Mini Chocolate Bar',
    handle: 'mini-chocolate-bar',
    productType: 'Chocolate Bars',
    tags: ['chocolate-bars', 'mini-bars', 'ready-to-ship'],
    descriptionHtml: `<p>A petite Roosha bar for small treats, return gifts, and bulk gifting. Approximate weight 10–15 g.</p><p>Choose plain, dried fruits, or filled.</p>`,
    options: [{ name: 'Style', values: ['Plain', 'Dried Fruits', 'Filled'] }],
    variants: [
      { price: '10.00', options: { Style: 'Plain' } },
      { price: '15.00', options: { Style: 'Dried Fruits' } },
      { price: '25.00', options: { Style: 'Filled' } },
    ],
    imageKey: 'roosha-mini-bar.jpg',
  },
  {
    title: 'Regular Chocolate Bar',
    handle: 'regular-chocolate-bar',
    productType: 'Chocolate Bars',
    tags: ['chocolate-bars', 'regular-bars', 'request-quote'],
    descriptionHtml: `<p>A refined everyday bar, approximately 20–25 g. Suitable for individual treats and selected decorative messages where lettering is feasible.</p><p><strong>Price on request</strong> — share your preferred finish and we will confirm availability.</p>`,
    variants: [{ price: '0.00', options: {} }],
    imageKey: 'roosha-bars-collection.jpg',
  },
  {
    title: 'Large Chocolate Bar',
    handle: 'large-chocolate-bar',
    productType: 'Chocolate Bars',
    tags: ['chocolate-bars', 'large-bars', 'request-quote'],
    descriptionHtml: `<p>A generous Roosha bar, approximately 60–80 g. Available plain or with dried fruits and berries.</p><p><strong>Price on request.</strong></p>`,
    options: [{ name: 'Style', values: ['Plain', 'Dried Fruits'] }],
    variants: [
      { price: '0.00', options: { Style: 'Plain' } },
      { price: '0.00', options: { Style: 'Dried Fruits' } },
    ],
    imageKey: 'roosha-large-bar.jpg',
  },
  {
    title: 'Filled Chocolate Bar',
    handle: 'filled-chocolate-bar',
    productType: 'Filled Chocolate Bars',
    tags: ['filled-bars', 'request-quote'],
    descriptionHtml: `<p>Your Chocolate. Your Filling. Your Choice.</p><p>A large filled bar (approximately 60–80 g) with indulgent centres. Select an available filling or request a custom flavour.</p><p><strong>Price on request.</strong></p>`,
    options: [
      {
        name: 'Filling',
        values: ['Kunafa', 'Strawberry', 'Blueberry', 'Mango', 'Rasmalai', 'Paan', 'Custom Request'],
      },
    ],
    variants: [
      { price: '0.00', options: { Filling: 'Kunafa' } },
      { price: '0.00', options: { Filling: 'Strawberry' } },
      { price: '0.00', options: { Filling: 'Blueberry' } },
      { price: '0.00', options: { Filling: 'Mango' } },
      { price: '0.00', options: { Filling: 'Rasmalai' } },
      { price: '0.00', options: { Filling: 'Paan' } },
      { price: '0.00', options: { Filling: 'Custom Request' } },
    ],
    imageKey: 'roosha-filled-bar.jpg',
  },
  {
    title: 'Line Chocolate — Plain',
    handle: 'line-chocolate-plain',
    productType: 'Line Chocolates',
    tags: ['line-chocolates', 'request-quote'],
    descriptionHtml: `<p>Elegant individual chocolates without filling — ideal for premium gifting and curated assortments.</p><p><strong>Price on request.</strong></p>`,
    variants: [{ price: '0.00', options: {} }],
    imageKey: 'roosha-line-chocolates.jpg',
  },
  {
    title: 'Line Chocolate — Dried Fruits',
    handle: 'line-chocolate-dried-fruits',
    productType: 'Line Chocolates',
    tags: ['line-chocolates', 'request-quote'],
    descriptionHtml: `<p>Individual line chocolates finished with dried fruits for special occasions and gift boxes.</p><p><strong>Price on request.</strong></p>`,
    variants: [{ price: '0.00', options: {} }],
    imageKey: 'roosha-line-chocolates.jpg',
  },
  {
    title: 'Festive Diwali Chocolate Box',
    handle: 'festive-diwali-chocolate-box',
    productType: 'Festive Gifting',
    tags: ['festive', 'diwali', 'request-quote'],
    descriptionHtml: `<p>Burgundy-and-gold festive packaging with elegant chocolate bars for Diwali gifting and return gifts.</p><p><strong>Price on request.</strong></p>`,
    variants: [{ price: '0.00', options: {} }],
    imageKey: 'roosha-festive-diwali.jpg',
  },
  {
    title: 'Wedding Favour Chocolate Box',
    handle: 'wedding-favour-chocolate-box',
    productType: 'Wedding & Corporate',
    tags: ['wedding', 'gifting', 'request-quote'],
    descriptionHtml: `<p>Small ivory and burgundy favour boxes for weddings, anniversaries, and celebrations. Personalisation available on request.</p><p><strong>Price on request.</strong></p>`,
    variants: [{ price: '0.00', options: {} }],
    imageKey: 'roosha-favour-box.jpg',
  },
  {
    title: 'Corporate Chocolate Hamper',
    handle: 'corporate-chocolate-hamper',
    productType: 'Wedding & Corporate',
    tags: ['corporate', 'gifting', 'request-quote'],
    descriptionHtml: `<p>A premium corporate hamper with glossy bars and curated chocolates in deep burgundy presentation. Branding subject to approval.</p><p><strong>Request a quote</strong> for bulk quantities.</p>`,
    variants: [{ price: '0.00', options: {} }],
    imageKey: 'roosha-hamper.jpg',
  },
  {
    title: 'Custom Chocolate Bar Enquiry',
    handle: 'custom-chocolate-bar-enquiry',
    productType: 'Custom Studio',
    tags: ['custom', 'request-quote', 'chocolate-bars'],
    descriptionHtml: `<p>Tell us your size, chocolate type, filling, dried-fruit options, message, festive design, or packaging needs. Our team will confirm feasibility and pricing.</p>`,
    variants: [{ price: '0.00', options: {} }],
    imageKey: 'roosha-filled-cross.jpg',
  },
];

const collectionDefs = [
  {
    title: 'Shop Chocolates',
    handle: 'shop-chocolates',
    descriptionHtml: '<p>Explore the full Roosha chocolate collection.</p>',
    productHandles: productDefs.map((p) => p.handle),
    imageKey: 'roosha-bars-collection.jpg',
  },
  {
    title: 'Chocolate Bars',
    handle: 'chocolate-bars',
    descriptionHtml: '<p>Mini, regular, and large chocolate bars for everyday craving and gifting.</p>',
    productHandles: ['mini-chocolate-bar', 'regular-chocolate-bar', 'large-chocolate-bar', 'custom-chocolate-bar-enquiry'],
    imageKey: 'roosha-bars-collection.jpg',
  },
  {
    title: 'Mini Bars',
    handle: 'mini-bars',
    descriptionHtml: '<p>10–15 g mini bars for treats, return gifts, and bulk gifting.</p>',
    productHandles: ['mini-chocolate-bar'],
    imageKey: 'roosha-mini-bar.jpg',
  },
  {
    title: 'Regular Bars',
    handle: 'regular-bars',
    descriptionHtml: '<p>20–25 g bars for individual treats and selected decorative messages.</p>',
    productHandles: ['regular-chocolate-bar'],
    imageKey: 'roosha-bars-collection.jpg',
  },
  {
    title: 'Large Bars',
    handle: 'large-bars',
    descriptionHtml: '<p>60–80 g bars, plain or with dried fruits.</p>',
    productHandles: ['large-chocolate-bar'],
    imageKey: 'roosha-large-bar.jpg',
  },
  {
    title: 'Filled Bars',
    handle: 'filled-bars',
    descriptionHtml: '<p>Your Chocolate. Your Filling. Your Choice.</p>',
    productHandles: ['filled-chocolate-bar'],
    imageKey: 'roosha-filled-bar.jpg',
  },
  {
    title: 'Line Chocolates',
    handle: 'line-chocolates',
    descriptionHtml: '<p>Elegant individual chocolates for premium assortments.</p>',
    productHandles: ['line-chocolate-plain', 'line-chocolate-dried-fruits'],
    imageKey: 'roosha-line-chocolates.jpg',
  },
  {
    title: 'Festive Gifting',
    handle: 'festive-gifting',
    descriptionHtml: '<p>Diwali, birthdays, anniversaries, and festive return gifts.</p>',
    productHandles: ['festive-diwali-chocolate-box', 'custom-chocolate-bar-enquiry'],
    imageKey: 'roosha-festive-diwali.jpg',
  },
  {
    title: 'Wedding & Corporate Gifting',
    handle: 'wedding-corporate-gifting',
    descriptionHtml: '<p>Wedding favours, corporate hampers, and bulk chocolate gifts.</p>',
    productHandles: ['wedding-favour-chocolate-box', 'corporate-chocolate-hamper'],
    imageKey: 'roosha-wedding-gifting.jpg',
  },
];

async function uploadAsset(filename, alt) {
  const filePath = path.join(ROOT, 'assets', filename);
  if (!fs.existsSync(filePath)) throw new Error(`Missing asset ${filename}`);
  const resourceUrl = await stagedUpload(filePath, 'image/jpeg');
  const file = await createFileFromStaged(resourceUrl, alt);
  const ready = await waitForFileReady(file.id);
  console.log('uploaded', filename, ready.image?.url?.slice(0, 80));
  return { fileId: ready.id, url: ready.image.url };
}

async function main() {
  const shop = await gql(`{ shop { name primaryDomain { url } currencyCode } }`);
  console.log('shop', shop.shop);

  // Update shop name if still generic
  if (shop.shop.name === 'My Store') {
    try {
      await gql(
        `mutation shopUpdate($input: ShopInput!) {
          shopUpdate(input: $input) { shop { name } userErrors { message } }
        }`,
        { input: { name: 'Roosha' } }
      );
      console.log('shop renamed to Roosha');
    } catch (e) {
      console.log('shop rename skipped', e.message.slice(0, 200));
    }
  }

  const imageMap = {};
  const needed = [
    'roosha-mini-bar.jpg',
    'roosha-bars-collection.jpg',
    'roosha-large-bar.jpg',
    'roosha-filled-bar.jpg',
    'roosha-line-chocolates.jpg',
    'roosha-festive-diwali.jpg',
    'roosha-favour-box.jpg',
    'roosha-hamper.jpg',
    'roosha-filled-cross.jpg',
    'roosha-hero-gift.jpg',
    'roosha-wedding-gifting.jpg',
    'roosha-story.jpg',
  ];
  for (const name of needed) {
    imageMap[name] = await uploadAsset(name, `Roosha ${name.replace(/-/g, ' ').replace('.jpg', '')}`);
  }

  const productsByHandle = {};
  for (const def of productDefs) {
    const media = def.imageKey
      ? [{ originalSource: imageMap[def.imageKey].url, alt: def.title, mediaContentType: 'IMAGE' }]
      : [];
    const created = await upsertProduct({ ...def, media });
    productsByHandle[def.handle] = created;
  }

  const collectionsByHandle = {};
  for (const def of collectionDefs) {
    const productIds = def.productHandles.map((h) => productsByHandle[h].id);
    const created = await upsertCollection({
      ...def,
      productIds,
      image: imageMap[def.imageKey]?.url,
    });
    collectionsByHandle[def.handle] = created;
  }

  const pagesByHandle = {};
  for (const page of Object.values(pages)) {
    pagesByHandle[page.handle] = await upsertPage(page);
  }

  // Menus — recreate cleanly
  const menusData = await gql(`query { menus(first: 50) { nodes { id handle title } } }`);
  async function recreateMenu(handle, title, items) {
    const existing = menusData.menus.nodes.find((m) => m.handle === handle);
    if (existing) {
      await gql(
        `mutation menuDelete($id: ID!) {
          menuDelete(id: $id) { deletedMenuId userErrors { message } }
        }`,
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
      throw new Error(JSON.stringify(created.menuCreate.userErrors));
    }
    console.log('created menu', handle);
    return created.menuCreate.menu;
  }

  await recreateMenu('main-menu', 'Main menu', [
    { title: 'Home', type: 'FRONTPAGE', url: '/' },
    {
      title: 'Shop Chocolates',
      type: 'COLLECTION',
      resourceId: collectionsByHandle['shop-chocolates'].id,
      items: [
        { title: 'Mini Bars', type: 'COLLECTION', resourceId: collectionsByHandle['mini-bars'].id },
        { title: 'Regular Bars', type: 'COLLECTION', resourceId: collectionsByHandle['regular-bars'].id },
        { title: 'Large Bars', type: 'COLLECTION', resourceId: collectionsByHandle['large-bars'].id },
        { title: 'Filled Bars', type: 'COLLECTION', resourceId: collectionsByHandle['filled-bars'].id },
        { title: 'Line Chocolates', type: 'COLLECTION', resourceId: collectionsByHandle['line-chocolates'].id },
      ],
    },
    { title: 'Chocolate Bars', type: 'COLLECTION', resourceId: collectionsByHandle['chocolate-bars'].id },
    { title: 'Premium Chocolates', type: 'COLLECTION', resourceId: collectionsByHandle['filled-bars'].id },
    { title: 'Festive Gifting', type: 'COLLECTION', resourceId: collectionsByHandle['festive-gifting'].id },
    {
      title: 'Wedding & Corporate Gifting',
      type: 'COLLECTION',
      resourceId: collectionsByHandle['wedding-corporate-gifting'].id,
    },
    { title: 'Our Story', type: 'PAGE', resourceId: pagesByHandle['our-story'].id },
    { title: 'Contact', type: 'PAGE', resourceId: pagesByHandle['contact'].id },
  ]);

  await recreateMenu('footer', 'Footer', [
    { title: 'Shop Chocolates', type: 'COLLECTION', resourceId: collectionsByHandle['shop-chocolates'].id },
    { title: 'Chocolate Bars', type: 'COLLECTION', resourceId: collectionsByHandle['chocolate-bars'].id },
    { title: 'Filled Chocolates', type: 'COLLECTION', resourceId: collectionsByHandle['filled-bars'].id },
    { title: 'Line Chocolates', type: 'COLLECTION', resourceId: collectionsByHandle['line-chocolates'].id },
    { title: 'Festive Collections', type: 'COLLECTION', resourceId: collectionsByHandle['festive-gifting'].id },
    {
      title: 'Wedding & Corporate Gifting',
      type: 'COLLECTION',
      resourceId: collectionsByHandle['wedding-corporate-gifting'].id,
    },
    { title: 'About Roosha', type: 'PAGE', resourceId: pagesByHandle['our-story'].id },
    { title: 'Contact Us', type: 'PAGE', resourceId: pagesByHandle['contact'].id },
    { title: 'Shipping and Delivery Policy', type: 'PAGE', resourceId: pagesByHandle['shipping-delivery-policy'].id },
    { title: 'Returns and Refunds Policy', type: 'PAGE', resourceId: pagesByHandle['return-refund-exchange-policy'].id },
    { title: 'Privacy Policy', type: 'PAGE', resourceId: pagesByHandle['privacy-policy'].id },
    { title: 'Terms and Conditions', type: 'PAGE', resourceId: pagesByHandle['terms-and-conditions'].id },
  ]);

  await recreateMenu('footer-shop', 'Footer Shop', [
    { title: 'Shop Chocolates', type: 'COLLECTION', resourceId: collectionsByHandle['shop-chocolates'].id },
    { title: 'Chocolate Bars', type: 'COLLECTION', resourceId: collectionsByHandle['chocolate-bars'].id },
    { title: 'Filled Chocolates', type: 'COLLECTION', resourceId: collectionsByHandle['filled-bars'].id },
    { title: 'Line Chocolates', type: 'COLLECTION', resourceId: collectionsByHandle['line-chocolates'].id },
    { title: 'Festive Collections', type: 'COLLECTION', resourceId: collectionsByHandle['festive-gifting'].id },
    {
      title: 'Wedding & Corporate Gifting',
      type: 'COLLECTION',
      resourceId: collectionsByHandle['wedding-corporate-gifting'].id,
    },
  ]);

  await recreateMenu('help', 'Help', [
    { title: 'Contact Us', type: 'PAGE', resourceId: pagesByHandle['contact'].id },
    { title: 'Shipping and Delivery Policy', type: 'PAGE', resourceId: pagesByHandle['shipping-delivery-policy'].id },
    { title: 'Returns and Refunds Policy', type: 'PAGE', resourceId: pagesByHandle['return-refund-exchange-policy'].id },
    { title: 'Privacy Policy', type: 'PAGE', resourceId: pagesByHandle['privacy-policy'].id },
    { title: 'Terms and Conditions', type: 'PAGE', resourceId: pagesByHandle['terms-and-conditions'].id },
  ]);

  fs.writeFileSync(
    path.join(ROOT, 'scripts/seed-result.json'),
    JSON.stringify({ productsByHandle, collectionsByHandle, pagesByHandle, imageMap }, null, 2)
  );
  console.log('DONE');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
