import "jasmine";
import { cold } from "jasmine-marbles";
import { initializeAdminApp } from "@firebase/testing";
import { Session } from "./session";
import { entity, Entity } from "./entity";
import { Repository } from "./repository";
import { shareReplay } from "rxjs/operators";
import { app, initializeApp } from "firebase-admin";

@entity("/products")
class Product extends Entity {
  price: number;
  categories: { [id: string]: true };
}

describe("Repository", () => {
  let app: app.App;
  let session: Session;
  let productRepo: Repository<Product>;
  beforeAll(() => {
    const testApp = initializeAdminApp({ databaseName: "test" });
    app = initializeApp(testApp.options);
  });
  beforeEach(() => {
    session = new Session(app.database());
    productRepo = session.repository(Product);
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
});

