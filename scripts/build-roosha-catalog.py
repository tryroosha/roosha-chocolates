#!/usr/bin/env python3
"""Build an original Roosha catalog JSON.

The collection map follows a premium Indian chocolatier shop
(shop, occasions, hampers, corporate). Names, descriptions, and
imagery keys are Roosha's — not another brand's copy or photos.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "roosha-catalog.json"

IMAGES = {
    "dragee": "roosha-line-chocolates.jpg",
    "toffee": "roosha-bars-collection.jpg",
    "truffle": "roosha-line-chocolates.jpg",
    "origin": "roosha-large-bar.jpg",
    "cookie": "roosha-bars-collection.jpg",
    "spread": "roosha-filled-bar.jpg",
    "bonbon": "roosha-line-chocolates.jpg",
    "artisanal": "roosha-filled-cross.jpg",
    "celebration": "roosha-festive-diwali.jpg",
    "edit": "roosha-hamper.jpg",
    "hamper": "roosha-hamper.jpg",
    "diwali": "roosha-festive-diwali.jpg",
    "favour": "roosha-favour-box.jpg",
    "corporate": "roosha-wedding-gifting.jpg",
    "giftcard": "roosha-hero-gift.jpg",
}

products = []


def add(title, handle, price, product_type, group, collections, line, tags=None, quote=False, options=None, variants=None):
    blurb = f"{line} Crafted by Roosha in Himachal Pradesh for gifting and everyday indulgence."
    item = {
        "title": title,
        "handle": handle,
        "productType": product_type,
        "descriptionHtml": f"<p>{blurb}</p>",
        "tags": list(tags or []) + (["request-quote"] if quote else ["ready-to-ship"]),
        "imageKey": IMAGES[group],
        "collections": list(collections),
        "seo": {"title": f"{title} | Roosha", "description": blurb[:155]},
    }
    if options and variants:
        item["options"] = options
        item["variants"] = variants
    else:
        item["price"] = f"{price:.2f}"
    if quote:
        item["price"] = "0.00"
    products.append(item)


# --- Dragée ---
dragee_lines = [
    ("Coffee Pecan Dragée", "coffee-pecan-dragee", 450, "Pecan and roasted coffee, coated in dark chocolate."),
    ("Milk Hazelnut Dragée", "milk-hazelnut-dragee", 450, "Whole hazelnuts wrapped in a smooth milk-chocolate shell."),
    ("Milk Almond Dragée", "milk-almond-dragee", 450, "Roasted almonds in milk chocolate, finished for sharing tins."),
    ("Strawberry Crunch Dragée", "strawberry-crunch-dragee", 450, "A bright strawberry centre with a crisp chocolate coat."),
    ("Sugar-Free Hazelnut Dragée", "sugar-free-hazelnut-dragee", 450, "Hazelnut dragée made without added sugar."),
    ("Butterscotch Nugget Dragée", "butterscotch-nugget-dragee", 450, "Butterscotch nuggets in a glossy chocolate shell."),
    ("Rose Almond Dragée", "rose-almond-dragee", 450, "Almonds scented with rose and coated in chocolate."),
    ("Dark Almond Dragée", "dark-almond-dragee", 450, "Almonds in a deeper dark-chocolate coat."),
    ("Cranberry Dragée", "cranberry-dragee", 450, "Tangy cranberries balanced with chocolate."),
    ("Coffee Bean Dragée", "coffee-bean-dragee", 450, "Chocolate-covered coffee beans for a late-evening tin."),
    ("Blueberry Cream Dragée", "blueberry-cream-dragee", 450, "Blueberry and cream notes inside a chocolate shell."),
    ("Pistachio Dragée", "pistachio-dragee", 450, "Pistachios coated in chocolate, packed for gifting."),
    ("Milk Hazelnut Dragée Pouch", "milk-hazelnut-dragee-pouch", 225, "A smaller pouch of milk-chocolate hazelnut dragée."),
    ("Butterscotch Nugget Pouch", "butterscotch-nugget-pouch", 225, "A pocket pouch of butterscotch nugget dragée."),
    ("Dark Almond Dragée Pouch", "dark-almond-dragee-pouch", 225, "A small pouch of dark-chocolate almond dragée."),
    ("Milk Almond Dragée Pouch", "milk-almond-dragee-pouch", 225, "A small pouch of milk-chocolate almond dragée."),
    ("Cranberry Dragée Pouch", "cranberry-dragee-pouch", 225, "A small pouch of cranberry dragée."),
    ("Pistachio Dragée Pouch", "pistachio-dragee-pouch", 225, "A small pouch of pistachio dragée."),
]
for title, handle, price, line in dragee_lines:
    cols = ["dragees"]
    if "Pouch" not in title:
        cols.append("gifting")
    add(title, handle, price, "Dragée", "dragee", cols, line)

# --- Toffee & brittles ---
for title, handle, price, line in [
    ("Almond Brittle Crunch", "almond-brittle-crunch", 600, "Toasted almonds set in buttery brittle and finished with chocolate."),
    ("Almond Brittle Pouch", "almond-brittle-pouch", 350, "A smaller pouch of almond brittle crunch."),
    ("Cashew Brittle Crunch", "cashew-brittle-crunch", 600, "Cashew brittle with a chocolate finish."),
    ("Almond Florentine", "almond-florentine", 380, "A thin florentine of almonds, caramel, and chocolate."),
    ("English Toffee", "english-toffee", 380, "Classic buttery toffee, cut for gifting tins."),
    ("Mango Toffee Bite", "mango-toffee-bite", 380, "A mango-scented toffee bite from the Roosha counter."),
]:
    add(title, handle, price, "Toffee", "toffee", ["toffee"], line)

# --- Truffles ---
for title, handle, line in [
    ("Salted Caramel Truffle", "salted-caramel-truffle", "A soft caramel centre with a pinch of salt, rolled in chocolate."),
    ("Hazelnut Truffle", "hazelnut-truffle", "Hazelnut praline folded through a chocolate truffle."),
    ("Cocoa-Dusted Origin Truffle", "cocoa-dusted-origin-truffle", "A dark truffle dusted in cocoa, made for after-dinner gifting."),
]:
    add(title, handle, 900 if "Origin" not in title else 960, "Chocolate Truffles", "truffle", ["chocolate-truffles", "gifting"], line)

# --- Single origin ---
for title, handle, line in [
    ("40% Ghana Milk Chocolate Bar", "ghana-milk-chocolate-bar", "A milk bar made with cocoa from Ghana."),
    ("70% Ecuador Dark Chocolate Bar", "ecuador-dark-chocolate-bar", "A dark bar with cocoa from Ecuador."),
    ("70% São Tomé Dark Chocolate Bar", "sao-tome-dark-chocolate-bar", "A dark bar with cocoa from São Tomé."),
    ("66% Madagascar Dark Chocolate Bar", "madagascar-dark-chocolate-bar", "A dark bar with cocoa from Madagascar."),
]:
    add(title, handle, 800, "Single Origin Chocolate Bars", "origin", ["single-origin-chocolate-bars"], line)

# --- Cookies ---
for title, handle, line in [
    ("Dark Chocolate Shortbread", "dark-chocolate-shortbread", "Shortbread dipped in dark chocolate."),
    ("Milk Chocolate Shortbread", "milk-chocolate-shortbread", "Shortbread dipped in milk chocolate."),
    ("Nib & Nut Shortbread", "nib-nut-shortbread", "Shortbread with cocoa nibs and nuts, finished in chocolate."),
]:
    add(title, handle, 550, "Chocolate Coated Shortbread Cookies", "cookie", ["chocolate-coated-shortbread-cookies"], line)

# --- Spreads ---
for title, handle, line in [
    ("Hazelnut Chocolate Spread", "hazelnut-chocolate-spread", "A jar of hazelnut and chocolate spread for breakfast and gifting."),
    ("Salted Caramel Spread", "salted-caramel-spread", "A jar of salted caramel spread with a chocolate finish."),
]:
    add(title, handle, 480, "Chocolate Spreads", "spread", ["chocolate-spreads"], line)

# --- Bonbons ---
for title, handle, price, ptype in [
    ("Bonbon & Praline Box of 6", "bonbon-praline-box-6", 600, "Bonbons & Pralines"),
    ("Bonbon & Praline Box of 12", "bonbon-praline-box-12", 1200, "Bonbons & Pralines"),
    ("Bonbon & Praline Box of 18", "bonbon-praline-box-18", 1800, "Bonbons & Pralines"),
    ("Bonbon Box of 6", "bonbon-box-6", 600, "Bonbons & Pralines"),
    ("Bonbon Box of 12", "bonbon-box-12", 1200, "Bonbons & Pralines"),
    ("Bonbon Box of 18", "bonbon-box-18", 1800, "Bonbons & Pralines"),
    ("Praline Box of 6", "praline-box-6", 600, "Bonbons & Pralines"),
    ("Praline Box of 12", "praline-box-12", 1200, "Bonbons & Pralines"),
    ("Praline Box of 18", "praline-box-18", 1800, "Bonbons & Pralines"),
]:
    count = title.split()[-1]
    kind = "bonbons and pralines" if "&" in title else ("bonbons" if title.startswith("Bonbon") else "pralines")
    add(
        title,
        handle,
        price,
        ptype,
        "bonbon",
        ["bonbons-pralines", "gifting"],
        f"A Roosha box of {count} {kind}, packed for celebrations.",
    )

# --- Artisanal ---
for title, handle, price, line in [
    ("Hill Coconut Fudge", "hill-coconut-fudge", 600, "A dense dark-chocolate fudge with real coconut."),
    ("Pistachio Kunafa Bar", "pistachio-kunafa-bar", 575, "Crisp kunafa and pistachio layered into a chocolate bar."),
    ("Cocoa Stick", "cocoa-stick", 350, "A slender chocolate stick for platters and favours."),
    ("Cocoa Stick Gift Box", "cocoa-stick-gift-box", 1199, "A gift box of chocolate sticks, tied for celebrations."),
    ("Kunafa Chocolate Box", "kunafa-chocolate-box", 1299, "Kunafa-filled chocolates in a celebration box."),
    ("Crackable Coconut Slab", "crackable-coconut-slab", 900, "A coconut chocolate slab meant to be cracked and shared."),
    ("Celebration Gold Bar", "celebration-gold-bar", 800, "A gold-toned celebration bar for milestones."),
    ("Double Chocolate Heart", "double-chocolate-heart", 600, "A heart of dark and milk chocolate for personal gifting."),
]:
    add(title, handle, price, "The Artisanal Collection", "artisanal", ["the-artisanal-collection"], line)

# --- Celebration bars ---
for title, handle, price, line, extra in [
    ("Happy Birthday Chocolate Bar", "happy-birthday-chocolate-bar", 799, "A message bar for birthdays, ready to wrap.", ["birthday", "occasions"]),
    ("Congratulations Chocolate Bar", "congratulations-chocolate-bar", 799, "A message bar for promotions, weddings, and new homes.", ["occasions"]),
    ("Thank You Chocolate Bar", "thank-you-chocolate-bar", 799, "A message bar for hosts, teams, and friends.", ["occasions"]),
    ("Diwali Almond Celebration Bar", "diwali-almond-celebration-bar", 525, "An almond bar finished for Diwali gifting.", ["diwali-collection", "festive-gifting"]),
]:
    add(title, handle, price, "Celebration Chocolate Bars", "celebration", ["celebration-chocolate-bars", *extra], line)

# --- Curated edits ---
for title, handle, price, line in [
    ("Artisan's Edit", "artisans-edit", 2099, "A mixed edit of Roosha favourites, packed as one gift."),
    ("Kunafa Edit", "kunafa-edit", 1780, "A kunafa-led assortment for people who like texture."),
    ("Dark Cocoa Edit", "dark-cocoa-edit", 2099, "A darker assortment for serious cocoa drinkers."),
    ("Hazelnut Edit", "hazelnut-edit", 1555, "Hazelnut dragée, praline, and spread-friendly pieces in one box."),
    ("Truffle Duo", "truffle-duo", 1780, "Two truffle styles, boxed together."),
    ("Coffee Edit", "coffee-edit", 1350, "Coffee dragée and cocoa pieces for an after-dinner gift."),
    ("Caramel Edit", "caramel-edit", 1780, "Caramel truffle and toffee notes in one gift box."),
    ("Dragée Edit", "dragee-edit", 1350, "A tin-style edit of Roosha dragées."),
]:
    add(title, handle, price, "Value Edits", "edit", ["value-edits", "gifting"], line)

# --- Hampers & festive boxes ---
hamper_rows = [
    ("Birthday Blush Hamper", "birthday-blush-hamper", 1449, "A softer birthday hamper with bars and a small assortment.", ["birthday", "hampers", "gifting", "occasions"]),
    ("Birthday Splendour Hamper", "birthday-splendour-hamper", 1949, "A fuller birthday hamper for the centre of the table.", ["birthday", "hampers", "gifting", "occasions"]),
    ("Birthday Opulence Hamper", "birthday-opulence-hamper", 2449, "A generous birthday hamper when the celebration is the gift.", ["birthday", "hampers", "gifting", "occasions"]),
    ("Birthday Celebration Hamper", "birthday-celebration-hamper", 2899, "Our largest birthday hamper, with room for a message.", ["birthday", "hampers", "gifting", "occasions"]),
    ("Happy Birthday Gift Box", "happy-birthday-gift-box", 1149, "A compact birthday box when a hamper is more than you need.", ["birthday", "hampers", "gifting", "occasions"]),
    ("Thank You Hamper", "thank-you-hamper", 2899, "A hamper for hosts, mentors, and clients.", ["hampers", "gifting", "occasions", "anniversaries", "weddings", "house-warming", "baby-shower"]),
    ("Congratulations Hamper", "congratulations-hamper", 2899, "A hamper for weddings, new homes, and good news.", ["hampers", "gifting", "occasions", "anniversaries", "weddings", "house-warming", "baby-shower"]),
    ("Festive Gift Box", "festive-gift-box", 875, "A compact festive box for Diwali rounds and return gifts.", ["hampers", "gifting", "diwali-collection", "festive-gifting"]),
    ("Valley Haven Hamper", "valley-haven-hamper", 1699, "A mid-size hamper with a calm, gift-ready edit.", ["hampers", "gifting", "occasions"]),
    ("Storybook Hamper", "storybook-hamper", 2199, "A narrative hamper of bars, dragée, and a small box.", ["hampers", "gifting", "occasions"]),
    ("Burgundy Decadence Hamper", "burgundy-decadence-hamper", 3999, "A deep burgundy hamper for people who want the richer edit.", ["hampers", "gifting", "occasions"]),
    ("Artisan Hamper", "artisan-hamper", 3099, "An artisan hamper led by filled bars and bonbons.", ["hampers", "gifting", "occasions"]),
    ("Hill Heritage Hamper", "hill-heritage-hamper", 4699, "A heritage hamper with single-origin bars and classic toffee.", ["hampers", "gifting", "occasions"]),
    ("Grand Gold Hamper", "grand-gold-hamper", 8299, "A large gold-toned hamper for the main gift of the evening.", ["hampers", "gifting", "occasions", "diwali-collection", "festive-gifting"]),
    ("Cellar & Cocoa Hamper", "cellar-cocoa-hamper", 9999, "A celebration hamper arranged for pairing with a bottle you choose.", ["hampers", "gifting", "diwali-collection", "festive-gifting"]),
    ("Indulgence Basket", "indulgence-basket", 3399, "An open basket of chocolates for housewarmings and anniversaries.", ["hampers", "gifting", "occasions"]),
    ("Diwali Celebration Gift Box", "diwali-celebration-gift-box", 1149, "A Diwali box with a festive sleeve and a mixed selection.", ["hampers", "gifting", "diwali-collection", "festive-gifting"]),
    ("Vintage Gold Hamper", "vintage-gold-hamper", 4349, "A vintage-gold hamper for festive hosts.", ["hampers", "gifting", "diwali-collection", "festive-gifting"]),
    ("Ridge Crescent Hamper", "ridge-crescent-hamper", 2799, "A curved-lid hamper for festive calls and family visits.", ["hampers", "gifting"]),
    ("Midnight Gold Hamper", "midnight-gold-hamper", 1350, "A darker festive hamper, sized for one household.", ["hampers", "gifting", "diwali-collection", "festive-gifting"]),
    ("Golden Hour Hamper", "golden-hour-hamper", 1499, "A warm festive hamper for evening deliveries.", ["hampers", "gifting", "diwali-collection", "festive-gifting"]),
    ("Courtyard Hamper", "courtyard-hamper", 1699, "A shareable festive hamper for the family table.", ["hampers", "gifting", "diwali-collection", "festive-gifting"]),
    ("Bazaar Street Hamper", "bazaar-street-hamper", 2699, "A festive hamper with a little of every Roosha counter.", ["hampers", "gifting", "diwali-collection", "festive-gifting"]),
    ("Quarter Festival Hamper", "quarter-festival-hamper", 3499, "A larger festive hamper for offices and joint families.", ["hampers", "gifting", "diwali-collection", "festive-gifting"]),
    ("House of Celebration Hamper", "house-of-celebration-hamper", 9999, "Our largest festive hamper, built for the main gift.", ["hampers", "gifting", "diwali-collection", "festive-gifting"]),
    ("Festival Glow Box", "festival-glow-box", 1099, "A bright festive box for Diwali rounds.", ["hampers", "gifting", "diwali-collection", "festive-gifting"]),
]
for title, handle, price, line, cols in hamper_rows:
    add(title, handle, price, "Hampers", "hamper" if "diwali" not in handle and "festiv" not in handle and "festival" not in handle and "glow" not in handle else "diwali", cols, line)

# Occasion collections share a common gift edit, matching a full chocolatier menu.
occasion_handles = {
    "anniversaries",
    "weddings",
    "house-warming",
    "baby-shower",
    "occasions",
}
occasion_products = {
    "thank-you-chocolate-bar",
    "congratulations-chocolate-bar",
    "burgundy-decadence-hamper",
    "hill-heritage-hamper",
    "valley-haven-hamper",
    "grand-gold-hamper",
    "artisan-hamper",
    "storybook-hamper",
    "thank-you-hamper",
    "congratulations-hamper",
    "indulgence-basket",
    "praline-box-12",
    "praline-box-18",
    "bonbon-box-12",
    "bonbon-box-18",
    "kunafa-chocolate-box",
    "crackable-coconut-slab",
    "cocoa-stick-gift-box",
    "cocoa-dusted-origin-truffle",
    "hazelnut-truffle",
    "salted-caramel-truffle",
    "cashew-brittle-crunch",
    "almond-brittle-crunch",
    "pistachio-kunafa-bar",
}
for p in products:
    if p["handle"] in occasion_products:
        for col in occasion_handles:
            if col not in p["collections"]:
                p["collections"].append(col)

# Birthday also carries the shared celebration edit.
for p in products:
    if p["handle"] in occasion_products and "birthday" not in p["collections"]:
        p["collections"].append("birthday")

# --- Favour boxes ---
for title, handle, price, line in [
    ("Burgundy Favour Box", "burgundy-favour-box", 600, "A small burgundy box for wedding favours and thank-yous."),
    ("Forest Favour Box", "forest-favour-box", 500, "A forest-green favour box for smaller celebrations."),
    ("Rust Favour Box", "rust-favour-box", 450, "A rust-toned favour box for festive tables."),
    ("Olive Favour Box", "olive-favour-box", 350, "An olive favour box for bulk return gifts."),
    ("Brick Favour Box", "brick-favour-box", 300, "A compact brick-red favour box."),
]:
    add(title, handle, price, "Favour Boxes", "favour", ["favour-boxes", "weddings", "gifting", "wedding-corporate-gifting"], line)

# --- Corporate, onboarding, return gifts (quote) ---
for title, handle, line, cols in [
    ("Client Signature Hamper", "client-signature-hamper", "A client hamper quoted to your brand, quantity, and delivery list.", ["corporate-gifting"]),
    ("Appreciation Box", "appreciation-box", "A thank-you box for teams and partners. Pricing confirmed on enquiry.", ["corporate-gifting"]),
    ("Leadership Collection", "leadership-collection", "A leadership gift, packed to a brief.", ["corporate-gifting"]),
    ("Prestige Hamper", "prestige-hamper", "A prestige hamper for senior gifting programmes.", ["corporate-gifting"]),
    ("Legacy Keepsake Box", "legacy-keepsake-box", "A keepsake box for milestones and retirements.", ["corporate-gifting"]),
    ("Executive Hamper", "executive-hamper", "An executive hamper with branding options on request.", ["corporate-gifting"]),
    ("Host's Selection", "hosts-selection", "A host gift selected with your event in mind.", ["corporate-gifting"]),
    ("Meeting Bites", "meeting-bites", "A smaller meeting gift for desks and conference days.", ["corporate-gifting"]),
    ("Team Welcome Hamper", "team-welcome-hamper", "A welcome hamper for a new teammate's first week.", ["employee-onboarding"]),
    ("Culture Welcome Box", "culture-welcome-box", "A welcome box that can carry a short note from the team.", ["employee-onboarding"]),
    ("First Week Box", "first-week-box", "A first-week box of chocolates, quoted for headcount.", ["employee-onboarding"]),
    ("Welcome Aboard Box", "welcome-aboard-box", "A welcome box for onboarding day.", ["employee-onboarding"]),
    ("Fresh Start Box", "fresh-start-box", "A fresh-start box for new joiners.", ["employee-onboarding"]),
    ("Sweet Start Hamper", "sweet-start-hamper", "A sweet start hamper for induction week.", ["employee-onboarding"]),
    ("New Joiner Hamper", "new-joiner-hamper", "A new-joiner hamper, packed to your brand colours on request.", ["employee-onboarding"]),
    ("Journey Start Hamper", "journey-start-hamper", "A journey-start hamper for larger onboarding batches.", ["employee-onboarding"]),
    ("Small Thank You", "small-thank-you", "A small return gift, priced once quantity is confirmed.", ["return-favours"]),
    ("Takeaway Treat", "takeaway-treat", "A takeaway treat for guests leaving a celebration.", ["return-favours"]),
    ("Farewell Bite", "farewell-bite", "A farewell bite for the end of an event.", ["return-favours"]),
    ("Gratitude Box", "gratitude-box", "A gratitude box for hosts and helpers.", ["return-favours"]),
    ("Recognition Box", "recognition-box", "A recognition box for awards and internal thanks.", ["return-favours"]),
    ("Note of Thanks Hamper", "note-of-thanks-hamper", "A short-note hamper for personal thanks at scale.", ["return-favours"]),
    ("Grace Gesture Hamper", "grace-gesture-hamper", "A quiet gesture hamper for sensitive occasions.", ["return-favours"]),
    ("Closing Gift Hamper", "closing-gift-hamper", "A closing gift for the end of a project or celebration.", ["return-favours"]),
]:
    cols = cols + ["wedding-corporate-gifting"]
    add(title, handle, 0, "Corporate & Gifting", "corporate", cols, line, quote=True)

add(
    "Roosha Gift Card",
    "roosha-gift-card",
    1000,
    "Gift Cards",
    "giftcard",
    ["gift-cards", "gifting"],
    "A Roosha gift card for someone who should choose their own box.",
    options=[{"name": "Amount", "values": ["₹1,000", "₹2,000", "₹5,000"]}],
    variants=[
        {"price": "1000.00", "options": {"Amount": "₹1,000"}},
        {"price": "2000.00", "options": {"Amount": "₹2,000"}},
        {"price": "5000.00", "options": {"Amount": "₹5,000"}},
    ],
)

# Best sellers and chef edits — merchandising collections, original selection.
best = {
    "happy-birthday-chocolate-bar",
    "almond-brittle-crunch",
    "coffee-pecan-dragee",
    "salted-caramel-truffle",
    "dark-chocolate-shortbread",
    "milk-hazelnut-dragee",
    "almond-florentine",
    "dark-almond-dragee",
    "butterscotch-nugget-pouch",
    "praline-box-6",
    "ghana-milk-chocolate-bar",
    "crackable-coconut-slab",
    "english-toffee",
    "milk-almond-dragee",
}
chefs = {
    "kunafa-chocolate-box",
    "cocoa-stick-gift-box",
    "cocoa-dusted-origin-truffle",
    "strawberry-crunch-dragee",
    "bonbon-box-12",
    "nib-nut-shortbread",
    "sao-tome-dark-chocolate-bar",
    "hazelnut-chocolate-spread",
    "sugar-free-hazelnut-dragee",
    "pistachio-dragee",
    "coffee-bean-dragee",
    "mango-toffee-bite",
    "cocoa-stick",
    "pistachio-kunafa-bar",
    "hill-coconut-fudge",
}
for p in products:
    if p["handle"] in best:
        p["collections"].append("best-sellers")
        p["tags"].append("best-seller")
    if p["handle"] in chefs:
        p["collections"].append("chefs-recommendation")
    if "shop-chocolates" not in p["collections"]:
        p["collections"].append("shop-chocolates")

handles = [p["handle"] for p in products]
dupes = {h for h in handles if handles.count(h) > 1}
if dupes:
    raise SystemExit(f"duplicate handles: {dupes}")

collections = [
    ("shop-chocolates", "Shop All", "The full Roosha cupboard — bars, dragée, bonbons, hampers, and gifts.", "roosha-bars-collection.jpg", False),
    ("dragees", "Dragée", "Chocolate-coated nuts, fruits, and coffee, in tins and pouches.", "roosha-line-chocolates.jpg", True),
    ("celebration-chocolate-bars", "Celebration Chocolate Bars", "Message bars for birthdays, thank-yous, and Diwali.", "roosha-festive-diwali.jpg", True),
    ("toffee", "Toffee", "Brittle, florentine, English toffee, and mango bites.", "roosha-bars-collection.jpg", True),
    ("chocolate-truffles", "Chocolate Truffles", "Caramel, hazelnut, and cocoa-dusted truffles.", "roosha-line-chocolates.jpg", True),
    ("single-origin-chocolate-bars", "Single Origin Chocolate Bars", "Milk and dark bars from Ghana, Ecuador, São Tomé, and Madagascar.", "roosha-large-bar.jpg", True),
    ("chocolate-coated-shortbread-cookies", "Chocolate Coated Shortbread Cookies", "Shortbread dipped in milk chocolate, dark chocolate, or nibs and nuts.", "roosha-bars-collection.jpg", True),
    ("the-artisanal-collection", "The Artisanal Collection", "Coconut fudge, kunafa, crackable slabs, and celebration shapes.", "roosha-filled-cross.jpg", True),
    ("chocolate-spreads", "Chocolate Spreads", "Hazelnut and salted caramel spreads.", "roosha-filled-bar.jpg", True),
    ("bonbons-pralines", "Bonbons & Pralines", "Boxes of 6, 12, and 18.", "roosha-line-chocolates.jpg", True),
    ("hampers", "Hampers", "Birthday, festive, and celebration hampers.", "roosha-hamper.jpg", True),
    ("birthday", "Birthday", "Birthday bars, boxes, and hampers.", "roosha-festive-diwali.jpg", True),
    ("anniversaries", "Anniversaries", "Thank-you bars, hampers, and boxes for anniversaries.", "roosha-hamper.jpg", True),
    ("weddings", "Weddings", "Favours, hampers, and celebration boxes for weddings.", "roosha-wedding-gifting.jpg", True),
    ("house-warming", "House Warming", "Hampers and boxes for a new home.", "roosha-hamper.jpg", True),
    ("baby-shower", "Baby Shower", "Gentle celebration gifts for a baby shower.", "roosha-favour-box.jpg", True),
    ("diwali-collection", "Diwali Collection", "Festive boxes and hampers for Diwali.", "roosha-festive-diwali.jpg", True),
    ("festive-gifting", "Festive Gifting", "Seasonal boxes and festive hampers.", "roosha-festive-diwali.jpg", False),
    ("gifting", "Gifting", "Hampers, edits, and boxes chosen for giving.", "roosha-hero-gift.jpg", True),
    ("occasions", "Occasions", "Chocolate for birthdays, weddings, new homes, and thank-yous.", "roosha-hamper.jpg", True),
    ("corporate-gifting", "Corporate Gifting", "Client and leadership gifts, quoted for your brief.", "roosha-wedding-gifting.jpg", True),
    ("employee-onboarding", "Employee Onboarding", "Welcome boxes and first-week hampers.", "roosha-favour-box.jpg", True),
    ("return-favours", "Return Favours", "Small gifts for guests, quoted by quantity.", "roosha-favour-box.jpg", True),
    ("favour-boxes", "Favour Boxes", "Small coloured boxes for weddings and thank-yous.", "roosha-favour-box.jpg", True),
    ("best-sellers", "Best Sellers", "The pieces Roosha guests ask for most.", "roosha-line-chocolates.jpg", True),
    ("chefs-recommendation", "Chef's Recommendation", "A shorter list from the Roosha kitchen.", "roosha-filled-cross.jpg", True),
    ("value-edits", "Value Edits", "Curated assortments — dark, kunafa, coffee, caramel, and more.", "roosha-hamper.jpg", True),
    ("gift-cards", "Gift Cards", "Let them choose their own Roosha box.", "roosha-hero-gift.jpg", True),
    ("wedding-corporate-gifting", "Wedding & Corporate Gifting", "Favours, onboarding, and corporate hampers.", "roosha-wedding-gifting.jpg", False),
]

collection_defs = []
for handle, title, description, image_key, create in collections:
    collection_defs.append(
        {
            "handle": handle,
            "title": title,
            "descriptionHtml": f"<p>{description}</p>",
            "imageKey": image_key,
            "create": create,
            "seo": {"title": f"{title} | Roosha", "description": description},
        }
    )

pages = [
    {
        "title": "Build Your Own Hamper",
        "handle": "build-your-own-hamper",
        "body": "<h1>Build Your Own Hamper</h1><p>Tell us the occasion, the number of hampers, a budget, and whether you want bars, dragée, bonbons, or a festive sleeve. We will confirm the edit, a note card, and delivery before you pay.</p><p>WhatsApp +91 77778 77253 or write to hello@tryroosha.com.</p>",
    },
    {
        "title": "Bulk Order",
        "handle": "bulk-order",
        "body": "<h1>Bulk Order</h1><p>Weddings, offices, and festive rounds are quoted on quantity, personalisation, and delivery city. Share your date, headcount, and whether boxes need a name or a logo.</p><p>WhatsApp +91 77778 77253 or write to hello@tryroosha.com.</p>",
    },
    {
        "title": "Chocolate Tasting",
        "handle": "chocolate-tasting",
        "body": "<h1>Chocolate Tasting</h1><p>Roosha can host a small tasting for teams and private celebrations — single-origin bars, dragée, and a bonbon flight. Tell us the city, the group size, and the date you have in mind.</p>",
    },
    {
        "title": "FAQs",
        "handle": "faqs",
        "templateSuffix": "faq",
        "body": "<p>Answers on shipping, returns, and chocolate care.</p>",
    },
]

navigation = {
    "main": [
        {
            "title": "Shop",
            "type": "COLLECTION",
            "handle": "shop-chocolates",
            "items": [
                {
                    "title": "Collection",
                    "type": "COLLECTION",
                    "handle": "shop-chocolates",
                    "items": [
                        {"title": "Dragée", "type": "COLLECTION", "handle": "dragees"},
                        {"title": "Celebration Chocolate Bars", "type": "COLLECTION", "handle": "celebration-chocolate-bars"},
                        {"title": "Toffee", "type": "COLLECTION", "handle": "toffee"},
                        {"title": "Chocolate Truffles", "type": "COLLECTION", "handle": "chocolate-truffles"},
                        {"title": "Single Origin Chocolate Bars", "type": "COLLECTION", "handle": "single-origin-chocolate-bars"},
                        {"title": "Chocolate Coated Shortbread Cookies", "type": "COLLECTION", "handle": "chocolate-coated-shortbread-cookies"},
                        {"title": "The Artisanal Collection", "type": "COLLECTION", "handle": "the-artisanal-collection"},
                        {"title": "Chocolate Spreads", "type": "COLLECTION", "handle": "chocolate-spreads"},
                        {"title": "Bonbons & Pralines", "type": "COLLECTION", "handle": "bonbons-pralines"},
                        {"title": "Shop All", "type": "COLLECTION", "handle": "shop-chocolates"},
                    ],
                },
                {
                    "title": "Hampers",
                    "type": "COLLECTION",
                    "handle": "hampers",
                    "items": [
                        {"title": "Festive Gift Box", "type": "PRODUCT", "handle": "festive-gift-box"},
                        {"title": "Burgundy Decadence Hamper", "type": "PRODUCT", "handle": "burgundy-decadence-hamper"},
                        {"title": "Hill Heritage Hamper", "type": "PRODUCT", "handle": "hill-heritage-hamper"},
                        {"title": "Valley Haven Hamper", "type": "PRODUCT", "handle": "valley-haven-hamper"},
                        {"title": "Grand Gold Hamper", "type": "PRODUCT", "handle": "grand-gold-hamper"},
                        {"title": "Artisan Hamper", "type": "PRODUCT", "handle": "artisan-hamper"},
                        {"title": "Indulgence Basket", "type": "PRODUCT", "handle": "indulgence-basket"},
                        {"title": "Storybook Hamper", "type": "PRODUCT", "handle": "storybook-hamper"},
                        {"title": "Shop All Hampers", "type": "COLLECTION", "handle": "hampers"},
                    ],
                },
            ],
        },
        {
            "title": "Occasions",
            "type": "COLLECTION",
            "handle": "occasions",
            "items": [
                {"title": "Birthday", "type": "COLLECTION", "handle": "birthday"},
                {"title": "Anniversaries", "type": "COLLECTION", "handle": "anniversaries"},
                {"title": "Weddings", "type": "COLLECTION", "handle": "weddings"},
                {"title": "House Warming", "type": "COLLECTION", "handle": "house-warming"},
                {"title": "Baby Shower", "type": "COLLECTION", "handle": "baby-shower"},
                {"title": "Diwali", "type": "COLLECTION", "handle": "diwali-collection"},
            ],
        },
        {
            "title": "Gifting",
            "type": "COLLECTION",
            "handle": "gifting",
            "items": [
                {"title": "Hampers", "type": "COLLECTION", "handle": "hampers"},
                {"title": "Bulk Order", "type": "PAGE", "handle": "bulk-order"},
                {"title": "Gift Cards", "type": "COLLECTION", "handle": "gift-cards"},
            ],
        },
        {
            "title": "Corporate",
            "type": "COLLECTION",
            "handle": "corporate-gifting",
            "items": [
                {"title": "Corporate Gifting", "type": "COLLECTION", "handle": "corporate-gifting"},
                {"title": "Employee Onboarding", "type": "COLLECTION", "handle": "employee-onboarding"},
                {"title": "Return Favours", "type": "COLLECTION", "handle": "return-favours"},
            ],
        },
        {"title": "Build Your Own Hamper", "type": "PAGE", "handle": "build-your-own-hamper"},
        {"title": "Best Sellers", "type": "COLLECTION", "handle": "best-sellers"},
        {"title": "Diwali Collection", "type": "COLLECTION", "handle": "diwali-collection"},
    ],
    "footerShop": [
        {"title": "Shop All", "type": "COLLECTION", "handle": "shop-chocolates"},
        {"title": "Dragée", "type": "COLLECTION", "handle": "dragees"},
        {"title": "Bonbons & Pralines", "type": "COLLECTION", "handle": "bonbons-pralines"},
        {"title": "Hampers", "type": "COLLECTION", "handle": "hampers"},
        {"title": "Best Sellers", "type": "COLLECTION", "handle": "best-sellers"},
        {"title": "Diwali Collection", "type": "COLLECTION", "handle": "diwali-collection"},
        {"title": "Corporate Gifting", "type": "COLLECTION", "handle": "corporate-gifting"},
    ],
    "help": [
        {"title": "Contact Us", "type": "PAGE", "handle": "contact"},
        {"title": "FAQs", "type": "PAGE", "handle": "faqs"},
        {"title": "Our Story", "type": "PAGE", "handle": "our-story"},
        {"title": "Chocolate Tasting", "type": "PAGE", "handle": "chocolate-tasting"},
        {"title": "Shipping and Delivery Policy", "type": "PAGE", "handle": "shipping-delivery-policy"},
        {"title": "Returns and Refunds Policy", "type": "PAGE", "handle": "return-refund-exchange-policy"},
        {"title": "Privacy Policy", "type": "PAGE", "handle": "privacy-policy"},
        {"title": "Terms and Conditions", "type": "PAGE", "handle": "terms-and-conditions"},
    ],
}

catalog = {
    "brand": "Roosha",
    "note": "Original Roosha catalog. Collection structure covers shop, occasions, hampers, and corporate gifting. Product names and descriptions are written for Roosha. Do not replace imagery with another brand's photographs.",
    "products": products,
    "collections": collection_defs,
    "pages": pages,
    "navigation": navigation,
}

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")
print(f"wrote {OUT}")
print("products", len(products))
print("collections", len(collection_defs))
