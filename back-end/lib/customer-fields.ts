export function normalizeCustomerFields(body: Record<string, unknown>) {
  const customerName = typeof body.customer_name === "string" ? body.customer_name.trim() : "";
  const phoneNumber = typeof body.phone_number === "string" ? body.phone_number.trim() : "";
  const placeLink = typeof body.place_link === "string" ? body.place_link.trim() : "";

  if (!customerName) {
    throw new Error("Customer name is required");
  }
  if (customerName.length > 191) {
    throw new Error("Customer name must be 191 characters or fewer");
  }
  if (phoneNumber.length > 191) {
    throw new Error("Phone number must be 191 characters or fewer");
  }
  if (placeLink) {
    let parsedLink: URL;
    try {
      parsedLink = new URL(placeLink);
    } catch {
      throw new Error("Place must be a valid Google Maps link");
    }
    if (
      placeLink.length > 2048 ||
      !["http:", "https:"].includes(parsedLink.protocol) ||
      !["google.com", "www.google.com", "maps.google.com", "maps.app.goo.gl", "goo.gl"].includes(parsedLink.hostname)
    ) {
      throw new Error("Place must be a valid Google Maps link");
    }
  }

  return {
    customer_name: customerName,
    phone_number: phoneNumber || null,
    place_link: placeLink || null,
  };
}
