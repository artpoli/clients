import { BehaviorSubject } from "rxjs";

import {
  SingleUserState,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

/** construct a method that outputs a copy of `defaultValue` as an observable. */
export function clone$PerUserId<Value>(defaultValue: Value) {
  const _subjects = new Map<UserId, BehaviorSubject<Value>>();

  return (key: UserId) => {
    let value = _subjects.get(key);

    if (value === undefined) {
      value = new BehaviorSubject({ ...defaultValue });
      _subjects.set(key, value);
    }

    return value.asObservable();
  };
}

/** construct a method that caches user-specific states by userid. */
export function sharedByUserId<Value>(create: (userId: UserId) => SingleUserState<Value>) {
  const _subjects = new Map<UserId, SingleUserState<Value>>();

  return (key: UserId) => {
    let value = _subjects.get(key);

    if (value === undefined) {
      value = create(key);
      _subjects.set(key, value);
    }

    return value;
  };
}

/** construct a method that loads a user-specific state from the provider. */
export function sharedStateByUserId<Value>(key: UserKeyDefinition<Value>, provider: StateProvider) {
  return (id: UserId) => provider.getUser<Value>(id, key);
}

/** returns the sum of items in the list. */
export const sum = (...items: number[]) =>
  (items ?? []).reduce((sum: number, current: number) => sum + (current ?? 0), 0);
