import { SessionImpl } from "./sessionImpl";
import { ClassConstructor, entityPath, Entity } from "./entity";
import { Observable } from "rxjs";
import { map, first } from "rxjs/operators";
import { QueryFunc, Query } from "./query";
import {database} from "firebase-admin";

export class Repository<T extends Entity> {
  constructor(private readonly sessionImpl: SessionImpl, private readonly cls: ClassConstructor<T>) {
  }

  public findById(id: string): Observable<T> {
    const path = this.combinePath(entityPath(this.cls), id);
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

  public findByIdAsPromise(id: string): Promise<T> {
    return this.findById(id).pipe(first()).toPromise();
  }

  public findAll(query?: QueryFunc<T>): Observable<T[]> {
    const basePath = entityPath(this.cls);
    return this.observableList(basePath, query).pipe(
      map((entityList) => {
        for (let i = 0; i < entityList.entities.length; ++i) {
          entityList.entities[i].id = entityList.ids[i];
          const fullPath = this.combinePath(basePath, entityList.ids[i]);
          this.sessionImpl.addToCache(entityList.entities[i], fullPath);
        }
        return entityList.entities;
      }),
    );
  }

  public save(entity: T) {
    this.sessionImpl.save(entity, this.objectPath(entity));
  }

  public delete(entity: T) {
    this.sessionImpl.delete(this.objectPath(entity));
  }

  public deleteById(id: string) {
    const path = this.combinePath(entityPath(this.cls), id);
    this.sessionImpl.delete(path);
  }

  private observableList(path: string, query?: QueryFunc<T>): Observable<EntityList<T>> {
    return new Observable(observer => {
      let ref: database.Query = this.sessionImpl.db.ref(path);
      if (query) {
        const q = query(new Query<T>());
        ref = q.toRef(ref);
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

  private combinePath(base: string, child: string) {
    return base + '/' + child;
  }

  private objectPath(entity: T) {
    return this.combinePath(entityPath(this.cls), entity.id);
  }
}

interface EntityList<T> {
  entities: T[];
  ids: string[];
}
