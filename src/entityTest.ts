import "jasmine";
import { entityPath, registerPersistedEntity } from "./entity";

class Product { }

describe("Entity", () => {
  it("registers with literal path", () => {
    registerPersistedEntity(Product, "/products");

    expect(entityPath(Product)).toEqual([
      { kind: "literal", literal: "/products" },
    ]);
  });

  it("registers with single bound path", () => {
    registerPersistedEntity(Product, "/products/{country}/items");

    expect(entityPath(Product)).toEqual([
      { kind: "literal", literal: "/products/" },
      { kind: "bound", binding: "country" },
      { kind: "literal", literal: "/items" },
    ]);
  });

  it("registers with multi-bound path", () => {
    registerPersistedEntity(Product, "/products/{country}/{category}");

    expect(entityPath(Product)).toEqual([
      { kind: "literal", literal: "/products/" },
      { kind: "bound", binding: "country" },
      { kind: "literal", literal: "/" },
      { kind: "bound", binding: "category" },
    ]);
  });

  it("registers with bound path at start", () => {
    registerPersistedEntity(Product, "{country}/products");

    expect(entityPath(Product)).toEqual([
      { kind: "bound", binding: "country" },
      { kind: "literal", literal: "/products" },
    ]);
  });

  it("registers with bound path at end", () => {
    registerPersistedEntity(Product, "/products/{country}");

    expect(entityPath(Product)).toEqual([
      { kind: "literal", literal: "/products/" },
      { kind: "bound", binding: "country" },
    ]);
  });

  it("registers with bound pathes near each other", () => {
    registerPersistedEntity(Product, "{products}{country}");

    expect(entityPath(Product)).toEqual([
      { kind: "bound", binding: "products" },
      { kind: "bound", binding: "country" },
    ]);
  });
});
