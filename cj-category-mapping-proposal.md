# CJ Dropshipping → Alpha Market Category Mapping Proposal

## Important note

CJ’s taxonomy is a live three-level tree. The official API exposes a first-level category, a second-level category, and a third-level category ID/name through `GET /api2.0/v1/product/getCategory`. Product search can then filter by third-level `categoryId`, second-level lists, or third-level lists. The mapping below is a proposed business mapping for Alpha Market, not a claim that these are every current third-level CJ label. CJ can add or rename detailed categories, so Alpha Market should sync the live tree rather than hard-code every name permanently.

## Alpha Market categories

Alpha Market currently has six broad categories:

- Fashion
- Gadgets
- Beauty
- Home & Furniture
- Vehicles
- Animals & Pets

## Proposed mapping

### Fashion

Map these CJ areas here:

- Women’s Clothing
- Men’s Clothing
- Bags & Shoes
- Jewelry & Watches
- Clothing Accessories
- Underwear and Sleepwear
- Costumes and Cosplay
- Wedding and Special-Occasion Clothing
- Luggage and Travel Accessories, only when the item is primarily a wearable or fashion accessory

Typical subcategory keywords include dresses, tops, shirts, trousers, jeans, skirts, jackets, coats, sweaters, hoodies, socks, underwear, handbags, backpacks, wallets, shoes, sandals, boots, belts, hats, scarves, sunglasses, jewelry, watches, and hair accessories.

### Gadgets

Map these CJ areas here:

- Consumer Electronics
- Phones & Telecommunications
- Computer & Office
- Office Electronics
- Camera, Photo & Video
- Smart Devices and Wearable Electronics
- Home Audio and Headphones
- Gaming and Game Accessories
- Electronic Components and Accessories
- 3D Printing and Maker Accessories

Typical subcategory keywords include smartphones, tablets, chargers, cables, power banks, adapters, earbuds, headphones, speakers, microphones, keyboards, mice, webcams, monitors, laptops, storage devices, cameras, tripods, smart watches, trackers, game controllers, consoles, LED devices, USB devices, printers, and projectors.

### Beauty

Map these CJ areas here:

- Health, Beauty & Hair
- Personal Care
- Makeup and Cosmetics
- Skin Care
- Hair Care and Wigs
- Nail Care
- Fragrance and Perfume
- Beauty Tools and Salon Equipment
- Massage and Personal Wellness Devices

Typical subcategory keywords include skincare, creams, serums, cleansers, makeup, lipstick, foundation, eyelashes, wigs, hair extensions, shampoo, hair styling tools, perfume, nail polish, manicure tools, facial devices, shaving products, and cosmetic storage.

Items marketed primarily as medical treatment, prescription products, ingestible supplements, or products with regulated health claims should not automatically enter Beauty. They should be held for review or rejected until Alpha Market defines a Health category and compliance policy.

### Home & Furniture

Map these CJ areas here:

- Home, Garden & Furniture
- Home Improvement
- Kitchen, Dining & Bar
- Home Decor
- Furniture
- Storage and Organization
- Bedding and Bath
- Garden and Outdoor Living
- Tools and Hardware, when intended for household use
- Lighting and Electrical Home Accessories
- Household Cleaning and Laundry
- Pet-home items that are not animal-specific, such as generic beds or storage

Typical subcategory keywords include sofas, chairs, tables, shelves, cabinets, storage boxes, organizers, curtains, rugs, carpets, bedding, towels, kitchen tools, cookware, dining items, lamps, lighting, wall decor, garden tools, planters, bathroom accessories, cleaning tools, and home improvement supplies.

### Vehicles

Map these CJ areas here:

- Automobiles & Motorcycles
- Vehicle Parts and Accessories
- Motorcycle Accessories
- Car Electronics and Safety Accessories
- Bicycle and Cycling Products
- Electric Scooters and Mobility Accessories
- Automotive Tools and Maintenance Accessories

Typical subcategory keywords include car accessories, motorcycle parts, bicycle accessories, helmets, vehicle lighting, dash cameras, car organizers, seat covers, chargers, pumps, tools, tires, maintenance products, and safety equipment.

Complete vehicles should be held for manual review. CJ’s normal dropshipping catalogue is more suitable for vehicle parts and accessories than for importing full cars or motorcycles as ordinary catalogue products.

### Animals & Pets

Map these CJ areas here:

- Pet Supplies
- Dog Supplies
- Cat Supplies
- Bird Supplies
- Fish and Aquarium Supplies
- Reptile Supplies
- Small Animal Supplies
- Pet Grooming and Training
- Pet Clothing and Accessories

Typical subcategory keywords include pet beds, collars, leashes, harnesses, feeders, bowls, toys, grooming tools, cages, aquariums, filters, bird accessories, cat furniture, dog clothing, and animal travel products.

Animal medicines, ingestible treatments, live animals, and products making veterinary claims should be held for manual review rather than imported automatically.

## CJ areas requiring a business decision

These areas do not have a perfect home in the six Alpha Market categories:

- Toys, Kids & Babies: recommended default is **hold for review**, unless you want it under Home & Furniture or a future Kids category.
- Sports & Outdoors: sports clothing can go to Fashion; sports electronics can go to Gadgets; equipment should be **hold for review** or Home & Furniture only for home fitness products.
- Tools: household tools can go to Home & Furniture; automotive tools can go to Vehicles; industrial tools should be **hold for review**.
- Health products and supplements: do not automatically map to Beauty because of regulatory and product-claim risk.
- Musical Instruments: recommended default is **hold for review**; small electronic accessories could go to Gadgets.
- Security & Protection: cameras and smart alarms can go to Gadgets; locks and hardware can go to Home & Furniture; other products should be held for review.
- Office and school supplies: ordinary desk accessories can go to Home & Furniture; electronics go to Gadgets.
- Food, beverages, and consumables: recommended default is **hold for review**.
- Industrial and commercial equipment: recommended default is **hold for review**.

## Recommended import behavior after approval

1. Alpha Market fetches CJ’s live category tree and stores the CJ third-level category ID, first-level name, second-level name, and third-level name with the import rule.
2. Each Alpha Market category contains approved CJ third-level category IDs and optional keyword rules.
3. A blank catalogue import queries only the approved CJ category IDs for the selected Alpha Market category.
4. A manually entered product is checked against its CJ category metadata before it becomes a draft. If it does not match, the import stops with a clear category-mismatch message.
5. Unmapped or regulated categories go to a review queue instead of being silently relabeled.
6. The category tree can be refreshed from CJ periodically so new CJ categories do not require a code deployment.

## Approval checklist

Please confirm or edit these decisions:

- Keep exactly the six Alpha Market categories listed above.
- Put Toys, Kids & Babies on hold, or create a new Kids category.
- Put Sports & Outdoors on hold, or allow selected fitness/outdoor subcategories under Home & Furniture.
- Put Tools on hold except household and automotive tools, or create a Tools category.
- Put Health products and supplements on hold under all circumstances, or allow selected non-regulated Beauty products.
- Put Musical Instruments on hold, or map accessories to Gadgets.
- Put Security & Protection on hold except cameras/alarms and household hardware.
- Put food, beverages, consumables, and industrial equipment on hold.

## Sources

- [1] [CJ Product API documentation](https://developers.cjdropshipping.com/en/api/api2/api/product.html) — official category-list endpoint, three-level category response, category IDs, and Product List V2 category filters.
- [2] [CJ official storefront](https://cjdropshipping.com/) — current visible catalogue groupings such as Women’s Clothing, Pet Supplies, Home, Garden & Furniture, Health, Beauty & Hair, Jewelry & Watches, Men’s Clothing, Bags & Shoes, and Toys, Kids & Babies.
- [3] [CJ API field definitions](https://developers.cjdropshipping.cn/en/api/api2/standard/field.html) — official product category fields including `categoryId` and `categoryName`.
