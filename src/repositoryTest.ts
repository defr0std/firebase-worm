import "jasmine";
import { cold } from "jasmine-marbles";
import { initializeAdminApp } from "@firebase/testing";
import { Session } from "./session";
import { entity, PersistedEntity, registerPersistedEntity } from "./entity";
import { Repository } from "./repository";
import { shareReplay } from "rxjs/operators";
import { app, initializeApp } from "firebase-admin";

@entity("/products")
class Product implements PersistedEntity {
  id: string;
  price: number;
  categories: { [id: string]: true };
  country?: string;
}

@entity("/{country}/products/{category}")
class NestedProduct implements PersistedEntity {
  id: string;
  price: number;
  category: string;
  country: string;
}

class ManualEntity implements PersistedEntity {
  id: string;
  name: string;
}
registerPersistedEntity(ManualEntity, "/manual");

describe("Repository", () => {
  let app: app.App;
  let session: Session;
  let productRepo: Repository<Product>;
  let nestedProductRepo: Repository<NestedProduct>;
  beforeAll(() => {
    const testApp = initializeAdminApp({ databaseName: "test" });
    app = initializeApp(testApp.options);
  });
  beforeEach(() => {
    session = new Session(app.database());
    productRepo = session.repository(Product);
    nestedProductRepo = session.repository(NestedProduct);
    app.database().ref("/").set(null);
  });

  it("finds entity by id", () => {
    app.database().ref("/products/1").set({
      price: 123,
    });

    const result = productRepo.findById("1");

    expect(result).toBeObservable(cold("a", {
      a: jasmine.objectContaining({
        id: "1",
        price: 123,
      }),
    }));
  });

  it("finds all entities", () => {
    app.database().ref("/products").set({
      id1: { price: 123 },
      id2: { price: 456 },
    });

    const result = productRepo.findAll();

    expect(result).toBeObservable(cold("a", {
      a: [
        jasmine.objectContaining({ id: "id1", price: 123 }),
        jasmine.objectContaining({ id: "id2", price: 456 }),
      ],
    }));
  });

  it("finds all entities as promise", async () => {
    app.database().ref("/products").set({
      id1: { price: 123 },
      id2: { price: 456 },
    });

    const result = await productRepo.findAllAsPromise();

    expect(result).toEqual([
      jasmine.objectContaining({ id: "id1", price: 123 }),
      jasmine.objectContaining({ id: "id2", price: 456 }),
    ]);
  });

  it("filters by child property", () => {
    app.database().ref("/products").set({
      id1: { price: 123 },
      id2: { price: 456 },
    });

    const result = productRepo.findAll(q => q.orderBy(x => x.price).equalTo(123));

    expect(result).toBeObservable(cold("a", {
      a: [
        jasmine.objectContaining({ price: 123 }),
      ],
    }));
  });

  it("filters by inner child property", () => {
    app.database().ref("/products").set({
      id1: { categories: { "cat1": true } },
      id2: { categories: { "cat2": true } },
    });

    const categoryId = "cat1";
    const result = productRepo.findAll(q => q.orderBy(x => x.categories[categoryId]).equalTo(true));

    expect(result).toBeObservable(cold("a", {
      a: [
        jasmine.objectContaining({ categories: { "cat1": true } }),
      ],
    }));
  });

  it("orders by keys", () => {
    app.database().ref("/products").set({
      id2: { price: 2 },
      id1: { price: 1 },
    });

    const result = productRepo.findAll(q => q.orderByKey());

    expect(result).toBeObservable(cold("a", {
      a: [
        jasmine.objectContaining({ id: "id1" }),
        jasmine.objectContaining({ id: "id2" }),
      ],
    }));
  });

  it("orders by keys", () => {
    app.database().ref("/products").set({
      id2: { price: 2 },
      id1: { price: 1 },
    });

    const result = productRepo.findAll(q => q.orderByKey());

    expect(result).toBeObservable(cold("a", {
      a: [
        jasmine.objectContaining({ id: "id1" }),
        jasmine.objectContaining({ id: "id2" }),
      ],
    }));
  });

  it("limits to first", () => {
    app.database().ref("/products").set({
      id1: { price: 1 },
      id2: { price: 2 },
      id3: { price: 3 },
    });

    const result = productRepo.findAll(q => q.orderByKey().limitToFirst(2));

    expect(result).toBeObservable(cold("a", {
      a: [
        jasmine.objectContaining({ id: "id1" }),
        jasmine.objectContaining({ id: "id2" }),
      ],
    }));
  });

  it("limits to last", () => {
    app.database().ref("/products").set({
      id1: { price: 1 },
      id2: { price: 2 },
      id3: { price: 3 },
    });

    const result = productRepo.findAll(q => q.orderByKey().limitToLast(2));

    expect(result).toBeObservable(cold("a", {
      a: [
        jasmine.objectContaining({ id: "id2" }),
        jasmine.objectContaining({ id: "id3" }),
      ],
    }));
  });

  it("starts at", () => {
    app.database().ref("/products").set({
      id1: { price: 1 },
      id2: { price: 2 },
      id3: { price: 3 },
    });

    const result = productRepo.findAll(q => q.orderByKey().startAt("id2"));

    expect(result).toBeObservable(cold("a", {
      a: [
        jasmine.objectContaining({ id: "id2" }),
        jasmine.objectContaining({ id: "id3" }),
      ],
    }));
  });

  it("ends at", () => {
    app.database().ref("/products").set({
      id1: { price: 1 },
      id2: { price: 2 },
      id3: { price: 3 },
    });

    const result = productRepo.findAll(q => q.orderByKey().endAt("id2"));

    expect(result).toBeObservable(cold("a", {
      a: [
        jasmine.objectContaining({ id: "id1" }),
        jasmine.objectContaining({ id: "id2" }),
      ],
    }));
  });

  it("listens to changes of single entity", () => {
    app.database().ref("/products/1").set({
      price: 123,
    });
    const result = productRepo.findById("1").pipe(shareReplay());
    result.subscribe();
    app.database().ref("/products/1/price").set(456);

    expect(result).toBeObservable(cold("(ab)", {
      a: jasmine.objectContaining({
        id: "1",
        price: 123,
      }),
      b: jasmine.objectContaining({
        id: "1",
        price: 456,
      }),
    }));
  });

  it("listens to changes to entities matching the query", () => {
    app.database().ref("/products").set({
      id1: { price: 1 },
      id2: { price: 2 },
      id4: { price: 4 },
    });

    const result = productRepo.findAll(q => q.orderByKey().startAt("id2").limitToFirst(2))
      .pipe(shareReplay());
    result.subscribe();
    app.database().ref("/products/id3").set({
      price: 3,
    });

    expect(result).toBeObservable(cold("(ab)", {
      a: [
        jasmine.objectContaining({ id: "id2" }),
        jasmine.objectContaining({ id: "id4" }),
      ],
      b: [
        jasmine.objectContaining({ id: "id2" }),
        jasmine.objectContaining({ id: "id3" }),
      ],
    }));
  });

  it("ignores changes to entities not related to the query", () => {
    app.database().ref("/products").set({
      id1: { price: 1 },
      id2: { price: 2 },
      id3: { price: 3 },
    });

    const result = productRepo.findAll(q => q.orderByKey().startAt("id2").limitToFirst(2))
      .pipe(shareReplay());
    result.subscribe();
    app.database().ref("/products/id4").set({
      price: 4,
    });

    expect(result).toBeObservable(cold("a", {
      a: [
        jasmine.objectContaining({ id: "id2" }),
        jasmine.objectContaining({ id: "id3" }),
      ],
    }));
  });

  it("inserts new entity with assigned id", async () => {
    const product = new Product();
    product.id = "product1";
    product.price = 123;

    productRepo.save(product);
    session.commit();

    const result = productRepo.findAll();
    expect(result).toBeObservable(cold("a", {
      a: [
        jasmine.objectContaining({ id: "product1", price: 123 }),
      ],
    }));
    const savedProduct = await readFromDb("/products/product1");
    expect(savedProduct).toEqual({
      price: 123,
    });
  });

  it("updates entity after insert", async () => {
    const product = new Product();
    product.id = "product1";
    product.price = 123;
    productRepo.save(product);

    product.price = 456;
    productRepo.save(product);
    session.commit();

    const result = productRepo.findAll();
    expect(result).toBeObservable(cold("a", {
      a: [
        jasmine.objectContaining({ price: 456 }),
      ],
    }));
  });

  it("updates entity after finding", async () => {
    app.database().ref("/products/1").set({
      price: 123,
    });

    const product = await productRepo.findByIdAsPromise("1");
    product.price = 345;
    product.price = 456;
    productRepo.save(product);
    session.commit();

    const result = productRepo.findAll();
    expect(result).toBeObservable(cold("a", {
      a: [
        jasmine.objectContaining({ price: 456 }),
      ],
    }));
  });

  it("updates entity after finding (setting same value twice)", async () => {
    app.database().ref("/products/1").set({
      price: 123,
    });

    const product = await productRepo.findByIdAsPromise("1");
    product.price = 456;
    product.price = 456;
    productRepo.save(product);
    session.commit();

    const result = productRepo.findAll();
    expect(result).toBeObservable(cold("a", {
      a: [
        jasmine.objectContaining({ price: 456 }),
      ],
    }));
  });

  it("updates entity after finding all", async () => {
    app.database().ref("/products/1").set({
      price: 123,
    });

    const products = await productRepo.findAllAsPromise();
    products[0].price = 456;
    productRepo.save(products[0]);
    session.commit();

    const result = productRepo.findAll();
    expect(result).toBeObservable(cold("a", {
      a: [
        jasmine.objectContaining({ price: 456 }),
      ],
    }));
  });

  it("deletes after finding", async () => {
    app.database().ref("/products/1").set({
      price: 123,
    });

    const product = await productRepo.findByIdAsPromise("1");
    productRepo.delete(product);
    session.commit();

    const result = productRepo.findAll();
    expect(result).toBeObservable(cold("a", {
      a: [],
    }));
  });

  it("deletes by id", async () => {
    app.database().ref("/products/1").set({
      price: 123,
    });

    productRepo.deleteById("1");
    session.commit();

    const result = productRepo.findAll();
    expect(result).toBeObservable(cold("a", {
      a: [],
    }));
  });

  it("supports manually registered entities", async () => {
    app.database().ref("/manual/1").set({
      name: "entity 1",
    });

    const entity = await session.repository(ManualEntity).findByIdAsPromise("1");

    expect(entity).toEqual(jasmine.objectContaining({
      id: "1",
      name: "entity 1",
    }));
  });

  it("accepts a raw path", async () => {
    app.database().ref("/raw/1").set({
      name: "entity 1",
    });

    const entity = await session.repository<ManualEntity>("/raw").findByIdAsPromise("1");

    expect(entity).toEqual(jasmine.objectContaining({
      id: "1",
      name: "entity 1",
    }));
  });

  describe("with bound path", () => {
    it("finds entity by id", () => {
      app.database().ref("/uk/products/food/1").set({
        price: 123,
      });

      const result = nestedProductRepo.findById("1", { country: "uk", category: "food" });

      expect(result).toBeObservable(cold("a", {
        a: jasmine.objectContaining({ id: "1", price: 123, country: "uk", category: "food" }),
      }));
    });

    it("checks bound fields when finding by id", () => {
      // Missing country path.
      expect(() => nestedProductRepo.findById("1", { country: "uk" })).toThrow();
    });

    it("checks extra bound fields", () => {
      expect(() => nestedProductRepo.findById(
        "1", { country: "uk", category: "food", subCategory: "sweets" })).toThrow();
    });

    it("finds all entities", () => {
      app.database().ref("/uk/products/food").set({
        id1: { price: 123 },
        id2: { price: 456 },
      });
      app.database().ref("/uk/products/drinks").set({
        id1: { price: 1000 },
        id2: { price: 2000 },
      });

      const result = nestedProductRepo.findAll(
        null, { country: "uk", category: "food" });

      expect(result).toBeObservable(cold("a", {
        a: [
          jasmine.objectContaining({ id: "id1", price: 123, country: "uk", category: "food" }),
          jasmine.objectContaining({ id: "id2", price: 456, country: "uk", category: "food" }),
        ],
      }));
    });

    it("checks bound fields when finding all", () => {
      // Missing country path.
      expect(() =>
        nestedProductRepo.findAll(null, { country: "uk" })).toThrow();
    });

    it("inserts new entity with assigned id", async () => {
      const product = new NestedProduct();
      product.id = "product1";
      product.country = "uk";
      product.category = "food";
      product.price = 123;

      nestedProductRepo.save(product);
      session.commit();

      const result = nestedProductRepo.findAll(null, { country: "uk", category: "food" });
      expect(result).toBeObservable(cold("a", {
        a: [
          jasmine.objectContaining({
            id: "product1", price: 123, country: "uk", category: "food"
          }),
        ],
      }));
      const savedProduct = await readFromDb("/uk/products/food/product1");
      expect(savedProduct).toEqual({
        price: 123,
      });
    });

    it("updates entity after insert", async () => {
      const product = new NestedProduct();
      product.id = "product1";
      product.country = "uk";
      product.category = "food";
      product.price = 123;
      nestedProductRepo.save(product);

      product.price = 456;
      nestedProductRepo.save(product);
      session.commit();

      const result = nestedProductRepo.findAll(null, { country: "uk", category: "food" });
      expect(result).toBeObservable(cold("a", {
        a: [
          jasmine.objectContaining({
            id: "product1", price: 456, country: "uk", category: "food"
          }),
        ],
      }));
    });

    it("deletes after finding", async () => {
      app.database().ref("/uk/products/food/1").set({
        price: 123,
        country: "uk",
        category: "food",
      });

      const product = await nestedProductRepo.findByIdAsPromise(
        "1", { country: "uk", category: "food" });
      nestedProductRepo.delete(product);
      session.commit();

      const result = nestedProductRepo.findAll(null, { country: "uk", category: "food" });
      expect(result).toBeObservable(cold("a", {
        a: [],
      }));
    });

    it("deletes by id", async () => {
      app.database().ref("/uk/products/food/1").set({
        price: 123,
      });

      nestedProductRepo.deleteById("1", { country: "uk", category: "food" });
      session.commit();

      const result = nestedProductRepo.findAll(null, { country: "uk", category: "food" });
      expect(result).toBeObservable(cold("a", {
        a: [],
      }));
    });

    it("updates in transaction", async () => {
      app.database().ref("/products/product1").set({
        price: 123,
      });

      const product = await productRepo.findByIdAsPromise("product1");
      product.price = 456;
      const transactionResult = await productRepo.updateInTransaction(product, (prev) => {
        if (prev.price === 123) {
          return product;
        }
      });

      expect(transactionResult).toEqual({
        committed: true,
        value: jasmine.objectContaining({ price: 456 }),
      });
      const result = productRepo.findAll();
      expect(result).toBeObservable(cold("a", {
        a: [
          jasmine.objectContaining({
            id: "product1", price: 456,
          }),
        ],
      }));
    });

    it("can abort transaction", async () => {
      app.database().ref("/products/product1").set({
        price: 123,
      });

      const product = await productRepo.findByIdAsPromise("product1");
      product.price = 456;
      const transactionResult = await productRepo.updateInTransaction(product, (prev) => {
        if (prev.price === 123) {
          return;
        }
        return product;
      });

      expect(transactionResult).toEqual({
        committed: false,
        value: jasmine.objectContaining({ price: 123 }),
      });
      const result = productRepo.findAll();
      expect(result).toBeObservable(cold("a", {
        a: [
          jasmine.objectContaining({
            id: "product1", price: 123,
          }),
        ],
      }));
    });

    describe("batched", () => {
      it("single batch less than size", () => {
        app.database().ref("/products").set({
          id1: { price: 1 },
          id2: { price: 2 },
        });

        const result = productRepo.findAllBatched(q => q.orderByKey(), null, 3);

        expect(result).toBeObservable(cold("(a|)", {
          a: [
            { id: "id1", price: 1, },
            { id: "id2", price: 2, },
          ],
        }));
      });

      it("single batch same as size", () => {
        app.database().ref("/products").set({
          id1: { price: 1 },
          id2: { price: 2 },
          id3: { price: 3 },
        });

        const result = productRepo.findAllBatched(q => q.orderByKey(), null, 3);

        expect(result).toBeObservable(cold("(a|)", {
          a: [
            { id: "id1", price: 1, },
            { id: "id2", price: 2, },
            { id: "id3", price: 3, },
          ],
        }));
      });

      it("one more than batch size", () => {
        app.database().ref("/products").set({
          id1: { price: 1 },
          id2: { price: 2 },
          id3: { price: 3 },
        });

        const result = productRepo.findAllBatched(q => q.orderByKey(), null, 2);

        expect(result).toBeObservable(cold("(ab|)", {
          a: [
            { id: "id1", price: 1, },
            { id: "id2", price: 2, },
          ],
          b: [
            { id: "id3", price: 3, },
          ],
        }));
      });

      it("two full batches", () => {
        const data = {};
        for (let i = 1; i <= 6; i++) {
          data["id" + i] = { price: i };
        }
        app.database().ref("/products").set(data);

        const result = productRepo.findAllBatched(q => q.orderByKey(), null, 3);

        expect(result).toBeObservable(cold("(ab|)", {
          a: [
            { id: "id1", price: 1, },
            { id: "id2", price: 2, },
            { id: "id3", price: 3, },
          ],
          b: [
            { id: "id4", price: 4, },
            { id: "id5", price: 5, },
            { id: "id6", price: 6, },
          ],
        }));
      });

      it("two full batches + spillover", () => {
        const data = {};
        for (let i = 1; i <= 7; i++) {
          data["id" + i] = { price: i };
        }
        app.database().ref("/products").set(data);

        const result = productRepo.findAllBatched(q => q.orderByKey(), null, 3);

        expect(result).toBeObservable(cold("(abc|)", {
          a: [
            { id: "id1", price: 1, },
            { id: "id2", price: 2, },
            { id: "id3", price: 3, },
          ],
          b: [
            { id: "id4", price: 4, },
            { id: "id5", price: 5, },
            { id: "id6", price: 6, },
          ],
          c: [
            { id: "id7", price: 7, },
          ],
        }));
      });

      it("filter on child", () => {
        const data = {};
        for (let i = 1; i <= 7; i++) {
          data["uk" + i] = { country: "uk", price: i };
          data["ch" + i] = { country: "ch", price: i };
        }
        app.database().ref("/products").set(data);

        const result = productRepo.findAllBatched(
          q => q.orderBy(x => x.country).equalTo("uk"),
          null, 3);

        expect(result).toBeObservable(cold("(abc|)", {
          a: [
            { id: "uk1", price: 1, country: "uk", },
            { id: "uk2", price: 2, country: "uk", },
            { id: "uk3", price: 3, country: "uk", },
          ],
          b: [
            { id: "uk4", price: 4, country: "uk", },
            { id: "uk5", price: 5, country: "uk", },
            { id: "uk6", price: 6, country: "uk", },
          ],
          c: [
            { id: "uk7", price: 7, country: "uk" },
          ],
        }));
      });

    });
  });

  function readFromDb(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      app.database().ref(path).once("value", (s) => {
        resolve(s.val());
      }, reject);
    });
  }
});

