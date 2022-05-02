import { database } from "firebase-admin";

function captureFields(q: (_: any) => any) {
  let proxy: object;
  const fields: string[] = [];

  const handlers = {
    get: (_: any, field: string) => {
      fields.push(field);
      return proxy;
    }
  }
  proxy = new Proxy({}, handlers);
  q(proxy);
  return fields;
}

export interface QueryParams {
  orderByChild?: string;
  equalTo?: any;
  orderByKey?: boolean;
  startAt?: string;
  startAtId?: string;
  endAt?: string;
  limitToFirst?: number;
  limitToLast?: number;
}

export class Query<T> {
  private params: QueryParams = {};

  orderBy(q: (obj: T) => any): Query<T> {
    this.params.orderByChild = captureFields(q).join("/");
    return this;
  }
  orderByKey(): Query<T> {
    this.params.orderByKey = true;
    return this;
  }
  startAt(value: string, id?: string): Query<T> {
    this.params.startAt = value;
    if (id) {
      this.params.startAtId = id;
    }
    return this;
  }
  endAt(value: string): Query<T> {
    this.params.endAt = value;
    return this;
  }
  limitToFirst(num: number): Query<T> {
    this.params.limitToFirst = num;
    return this;
  }
  limitToLast(num: number): Query<T> {
    this.params.limitToLast = num;
    return this;
  }
  equalTo(v: any): Query<T> {
    this.params.equalTo = v;
    return this;
  }

  getParams(): QueryParams {
    return this.params;
  }

  toRef(ref: database.Query): database.Query {
    if (this.params.orderByChild) {
      ref = ref.orderByChild(this.params.orderByChild);
    }
    if (this.params.orderByKey) {
      ref = ref.orderByKey();
    }
    if (this.params.startAt !== undefined) {
      ref = ref.startAt(this.params.startAt, this.params.startAtId);
    }
    if (this.params.endAt !== undefined) {
      ref = ref.endAt(this.params.endAt);
    }
    if (this.params.limitToFirst !== undefined) {
      ref = ref.limitToFirst(this.params.limitToFirst);
    }
    if (this.params.limitToLast !== undefined) {
      ref = ref.limitToLast(this.params.limitToLast);
    }
    if (this.params.equalTo) {
      ref = ref.equalTo(this.params.equalTo);
    }
    return ref;
  }
}

export type QueryFunc<T> = (q: Query<T>) => Query<T>;


