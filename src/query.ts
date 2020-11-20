import {database} from "firebase-admin";

function captureFields(q: (_: any) => any) {
  let proxy: object;
  const fields: string[] = [];

  const handlers = {
    get: (_, field) => {
      fields.push(field);
      return proxy;
    }
  }
  proxy = new Proxy({}, handlers);
  q(proxy);
  return fields;
}

export class Query<T> {
  private childPath: string[];
  private doEqualTo: any;
  private doOrderByKey: boolean;
  private doStartAt: string;
  private doEndAt: string;
  private doLimitToFirst: number;
  private doLimitToLast: number;

  orderBy(q: (obj: T) => any): Query<T> {
    this.childPath = captureFields(q);
    return this;
  }
  orderByKey(): Query<T> {
    this.doOrderByKey = true;
    return this;
  }
  startAt(key: string): Query<T> {
    this.doStartAt = key;
    return this;
  }
  endAt(key: string): Query<T> {
    this.doEndAt = key;
    return this;
  }
  limitToFirst(num: number): Query<T> {
    this.doLimitToFirst = num;
    return this;
  }
  limitToLast(num: number): Query<T> {
    this.doLimitToLast = num;
    return this;
  }
  equalTo(v: any): Query<T> {
    this.doEqualTo = v;
    return this;
  }

  toRef(ref: database.Query): database.Query {
    if (this.childPath) {
      ref = ref.orderByChild(this.childPath.join("/"));
    }
    if (this.doOrderByKey) {
      ref = ref.orderByKey();
    }
    if (this.doStartAt !== undefined) {
      ref = ref.startAt(this.doStartAt);
    }
    if (this.doEndAt !== undefined) {
      ref = ref.endAt(this.doEndAt);
    }
    if (this.doLimitToFirst !== undefined) {
      ref = ref.limitToFirst(this.doLimitToFirst);
    }
    if (this.doLimitToLast !== undefined) {
      ref = ref.limitToLast(this.doLimitToLast);
    }
    if (this.doEqualTo) {
      ref = ref.equalTo(this.doEqualTo);
    }
    return ref;
  }
}

export type QueryFunc<T> = (q: Query<T>) => Query<T>;


