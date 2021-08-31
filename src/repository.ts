import { SessionImpl } from "./sessionImpl";
import { analyzePath, BoundPath, entityPath, EntitySpec, PathComponent, PathMap, PersistedEntity } from "./entity";
import { Observable } from "rxjs";
import { map, first } from "rxjs/operators";
import { QueryFunc, Query } from "./query";
import { database } from "firebase-admin";

export class Repository<T extends PersistedEntity> {
  private readonly basePath: PathComponent[];
  private readonly boundComponents: BoundPath[];

  constructor(
    private readonly sessionImpl: SessionImpl,
    spec: EntitySpec<T>,
  ) {
    this.basePath = typeof spec === "string" ?
      analyzePath(spec) : entityPath(spec);
    this.boundComponents = this.basePath.filter(x => x.kind === "bound") as BoundPath[];
  }

  public findById(id: string, pathMap?: PathMap): Observable<T> {
    const mapping = Object.assign({}, pathMap, { id });
    const path = this.resolvePath(mapping);

    return this.observableObject<T>(path).pipe(
      map((entity) => {
        if (entity) {
          entity.id = id;
          this.sessionImpl.addToCache(entity, path);
        }
        return entity;
      }),
    );
  }

  public findByIdAsPromise(id: string, pathMap?: PathMap): Promise<T> {
    return this.findById(id, pathMap).pipe(first()).toPromise();
  }

  public findAll(query?: QueryFunc<T>, pathMap?: PathMap): Observable<T[]> {
    let q: Query<T> = null;
    if (query) {
      q = query(new Query<T>());
    }
    const path = this.resolvePath(pathMap || {});
    return this.observableList(path, q).pipe(
      map((entityList) => {
        for (let i = 0; i < entityList.entities.length; ++i) {
          const entityPath = `${path}/${entityList.ids[i]}`;
          entityList.entities[i].id = entityList.ids[i];
          this.sessionImpl.addToCache(entityList.entities[i], entityPath);
        }
        return entityList.entities;
      }),
    );
  }

  public findAllAsPromise(query?: QueryFunc<T>, pathMap?: PathMap): Promise<T[]> {
    return this.findAll(query, pathMap).pipe(first()).toPromise()
  }

  public save(entity: T) {
    const mapping = this.getPathMappingForEntity(entity);
    const path = this.resolvePath(mapping);
    this.sessionImpl.save(entity, path);
  }

  public delete(entity: T) {
    const mapping = this.getPathMappingForEntity(entity);
    const path = this.resolvePath(mapping);
    this.sessionImpl.delete(path);
  }

  public deleteById(id: string, pathMap?: PathMap) {
    const mapping = Object.assign({}, pathMap, { id });
    const path = this.resolvePath(mapping);
    this.sessionImpl.delete(path);
  }

  private observableList(path: string, query?: Query<T>): Observable<EntityList<T>> {
    return new Observable(observer => {
      let ref: database.Query = this.sessionImpl.db.ref(path);
      if (query) {
        ref = query.toRef(ref);
      }
      ref.on("value", s => {
        const res: EntityList<T> = {
          entities: [],
          ids: [],
        };
        s.forEach(c => {
          res.entities.push(c.val());
          res.ids.push(c.key);
        });
        observer.next(res);
      })
    });
  }

  private observableObject<T>(path: string): Observable<T> {
    return new Observable(observer => {
      const ref = this.sessionImpl.db.ref(path);
      ref.on("value", (s) => {
        observer.next(s.val());
      });
    });
  }

  private resolvePath(pathMap: PathMap) {
    const parts: string[] = [];
    const usedFields = new Set<string>();
    for (const component of this.basePath) {
      if (component.kind === "literal") {
        parts.push(component.literal);
      }
      else if (component.kind === "bound") {
        const boundValue = pathMap[component.binding];
        if (boundValue === null || boundValue === undefined || boundValue === "") {
          throw new Error(`Must provide a value for binding ${component.binding}`);
        }
        parts.push(boundValue);
        usedFields.add(component.binding);
      }
    }
    for (const binding in pathMap) {
      if (!pathMap.hasOwnProperty(binding)) {
        continue;
      }
      if (binding !== "id" && !usedFields.has(binding)) {
        throw new Error(
          `Path bindings specified, but not used for this entity. ${JSON.stringify(pathMap)}`)
      }
    }
    if (pathMap.id) {
      parts.push(`/${pathMap.id}`);
    }
    return parts.join("");
  }

  private getPathMappingForEntity(entity: T): PathMap {
    const mapping: PathMap = {};
    mapping.id = entity.id;
    for (const component of this.boundComponents) {
      mapping[component.binding] = entity[component.binding];
    }
    return mapping;
  }
}

interface EntityList<T> {
  entities: T[];
  ids: string[];
}

