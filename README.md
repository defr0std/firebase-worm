# firebase-worm - Firebase With ORM

`firebase-worm` is a lightweight Object Relational Mapping implementation for 
Firebase Realtime Database.

## Setting up session

When working with NoSQL databases, more often than not it is needed to update multiple objects at the same time.
Therefore, the base object to work with is a `Session`.

```typescript
import {Session} from 'firebase-worm';

// Initialize your firebase application in any preferred way.
const firebaseConfig = {
  // ...
};
const app = firebase.initializeApp(firebaseConfig);

// Create firebase-worm session
const session = new Session(app.database());

// ... work with the session ...

// Commit the changes
await session.commit();

// Don't forget to dispose
session.dispose();
```

`firebase-worm` does not initialize the firebase application. You need to do it 
yourself in your preferred way, and then create a `Session` object using 

The `Session` accumulates the changes in memory as you work with the entities. When
`Session.commit` is called, all changes are persisted to the database.

Don't forget to dispose the session when it's no longer needed, this clears the 
listeners on database keys.

## Defining entities

An entity is plain javascript object which is persisted to the database.

```typescript
import {Entity} from 'firebase-worm';

@entity("/products")
class Product extends Entity {
  name: string;
  price: number;
}

/* Corresponds to the following structure:
{
  "/products": {
    "product1": {
      name: "Product 1", 
      price: 100
    },
    "product2": {
      name: "Product 2",
      price: 200
    }
    ...
  }
}
*/
```

Entities are modelled as classes, extending the base `Entity` class.
The `@entity()` decorator specifies the path in the JSON tree where the collection 
is persisted.

## Querying data

To query the entities, you need to create an instance of the `Repository`.
The repository exposes the data as `rxjs` observables. When the underlying data 
changes in firebase, new values are emitted.

```typescript
{
  "/products": {
    "product1": {
      name: "Product 1" 
    },
    "product2": {
      name: "Product 2"
    }
  }
}

// This is the repository for working with a Product entity.
const repository = session.repository(Product);

// Find a single entity by id.
repository.findById("product1").subscribe((product) => {
  console.log(product.$id, product.name); // product1, "Product 1"
});

// Find all products with a given name. Note property accessor syntax for the query:
// x => x.name
// You can build your queries in a safe compile-time manner.
repository
  .findAll(q => q.orderBy(x => x.name).equalTo("Product 2"))
  .subscribe(products => {
    console.log(products); // [{$id: "product2", name: "Product 2"}];
  });

// The query syntax may also include child properties, dynamic properties, etc.
// For example, consider the following model:
{
  "/products": {
    "product1": {
      name: "Product 1", 
      info: {
        categories: {
          category1: true,
        }
      }
    },
    "product2": {
      name: "Product 2",
      info: {
        categories: {
          category2: true,
        }
      }
    }
  }
}

// Let's say the categoryId is coming as an input to a query.
// Find all products by category2:
const categoryId = "category2";
repository
  .findAll(q => q.orderBy(x => x.info.categories[categoryId]).equalTo(true))
  .subscribe(products => {
    console.log(products); // [{$id: "product2", ...}];
  });
```

## Inserting data

To insert new entities into the database, call the `save` method on the repository,
and then commit the session.

```typescript
@entity("/products")
class Product extends Entity {
  name: string;
  price: number;
}

const session = new Session(app.database());
const repository = session.repository(Product);

const product = new Product();
// An id can be manually assigned. If not present, uuid-v6 will be assigned.
product.$id = "p1";
product.name = "product 1";
product.price = 100;

// Saves changes in memory. Since product "p1" is not known yet to the
// session, it is considered to be a new entity and will be inserted.
repository.save(product);

// Flushes all changes to the database.
await session.commit();
```

## Updating data

All entities found with `Repository.find` or `Repository.findAll` are tracked for
changes. When `Repository.save` is called, a partial diff is calculated and stored
in memory. `Session.commit` flushes all diffs to the database.

```typescript
@entity("/products")
class Product extends Entity {
  name: string;
  price: number;
}

const session = new Session(app.database());
const repository = session.repository(Product);

repository.findById("product1").pipe(
  concatMap(product => {
    // Update the value in memory.
    product.price = 200;
    // Let the repository calculate the diff.
    repository.save(product);
    // Flush changes: {"/products/product1/price": 200}
    return session.commit();
  })
).subscribe();
```

## Deleting data

Similarly to udpates, calling `Repository.delete` or `Repository.deleteById` marks
the corresponding key as `null`.

```typescript
@entity("/products")
class Product extends Entity {
  name: string;
  price: number;
}

const session = new Session(app.database());
const repository = session.repository(Product);

// Find and delete a product
repository.findById("product1").pipe(
  concatMap(product => {
    // Let the repository calculate the diff.
    repository.delete(product);
    // Flush changes: {"/products/product1": null}
    return session.commit();
  })
).subscribe();

// Or delete an entity without finding it first
repository.deleteById("product1");
// Flush changes: {"/products/product1": null}
await session.commit();
```
