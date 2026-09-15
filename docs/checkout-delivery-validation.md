# Checkout Delivery Validation Notes

The public Range Rover vendor listing at `/product/vendor-90001` visually renders both required actions: **Ask about this product** and **Add to Cart**. The latter is implemented as an in-app cart action rather than an external WhatsApp link.

The unauthenticated checkout route correctly displays its empty-cart state. The populated checkout form is protected by cart state; its structured Nigeria address selectors and delivery quote logic are covered by shared, server, and client regression tests.

Live browser validation added the approved Range Rover vendor listing to cart through the new in-app action, then opened checkout. The populated checkout shows the locked Nigeria field, a selector containing all 36 states plus the Federal Capital Territory, the dependent LGA selector, street-details field, standard/express delivery selector, calculated-delivery summary, and the bottom seller-contact note.

Selecting Lagos populated its LGAs and produced the ₦9,500 intra-state standard quote for the included 2 kg. Increasing the estimate to 3 kg immediately applied the ₦1,000 surcharge and updated both the quote and order summary to ₦10,500.

Changing the same 3 kg Lagos delivery to Express correctly applied the 1.5× tier multiplier, resulting in a ₦15,750 delivery fee and updated order total.

The initial attempt to drag the native Tawk launcher did not work in the user’s browser. It was replaced with a dedicated global **Support** control that handles mouse and touch drag events, persists its position, and opens the Tawk chat API. A mobile preview confirms the dedicated control appears above the bottom navigation without the duplicate native launcher.

The live product page exposes the dedicated control with the accessible label “Open customer support chat. Drag to move it away from checkout controls.” Browser-driven verification confirmed that the rendered control moves substantially for both mouse input and touch input, rather than merely accepting the events.

After being moved, clicking the custom Support control opened the live Tawk customer-support conversation window. The native launcher remains hidden to avoid duplicate, overlapping chat controls.

The browser console was empty after the live vendor-cart, delivery-calculator, and custom-support interactions.

The external Paystack read-only credential check was separately diagnosed during validation and returned HTTP 403 from Paystack. It is unrelated to this checkout update, which remains Pay on Delivery; no payment credential was exposed or altered.
