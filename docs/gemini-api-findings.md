# Gemini API Integration Notes

Google’s Gemini documentation confirms that structured outputs can be requested with a JSON schema and returned as `application/json`, allowing server code to validate predictable fields before persisting them. The API reference documents a read-only models endpoint, which is used by `server/gemini.secret.test.ts` to validate the managed `GEMINI_API_KEY` without generating content or changing any product.

The product-enhancement workflow will send only administrator-visible catalogue title, description, and optional specifications to the server-side Gemini request. Supplier identifiers, costs, buyer data, delivery addresses, fulfilment actions, and product publication controls remain outside the prompt and response contract.

Sources: https://ai.google.dev/gemini-api/docs/structured-output and https://ai.google.dev/api/models
