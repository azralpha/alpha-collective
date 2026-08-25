# CJ API Findings for Inventory and Landed-Cost Imports

The design uses only documented, server-side, read-only CJ catalogue and logistics endpoints. No endpoint below creates a supplier order or transmits customer data.

| Need | Endpoint and fields used | Safety rule |
| --- | --- | --- |
| Catalogue lookup | `GET /product/listV2` with SKU keyword matching | Used for the existing draft import only. |
| Product/variant inventory | `GET /product/query?productSku=...`; `variants[].vid`, `variantSku`, and `inventories[].totalInventory` / `cjInventory` / `factoryInventory` | A mass import selects an available variant. A later sync refreshes the originally mapped variant only; if that variant is unavailable, stock becomes zero rather than switching the listing to a different variant. |
| Shipping quote to Nigeria | `POST /logistic/freightCalculate`; `startCountryCode`, `endCountryCode: NG`, `products[{quantity:1, vid}]`; response `totalPostageFee` or `logisticPrice` | A product is not mass-imported when CJ provides no usable Nigeria quote. |

The mass importer calculates the private landed supplier cost as product cost plus the selected CJ shipping quote in USD. It then applies a required, administrator-entered USD-to-Naira rate and markup percentage to create an **unpublished** Alpha Collective draft. Public views expose only Alpha Collective stock availability, never supplier names, supplier cost components, raw CJ logistics output, source/variant IDs, or fulfilment configuration.

The prepared inventory-sync endpoint is cron-only and intentionally unactivated until the site is published. It is idempotent and does not create orders.

## Official sources

- [CJ Product API documentation](https://developers.cjdropshipping.cn/en/api/api2/api/product.html)
- [CJ Logistics API documentation](https://developers.cjdropshipping.cn/en/api/api2/api/logistic.html)
