# GAP-10: @mock Directive Specification

## Overview

This proposal defines the `@mock` directive, enabling GraphQL clients to return
mocked data for fields or entire operations. Mock data is stored statically in
JSON files alongside the operations that use them.

## Motivation

Client and backend developers often work in parallel, but clients cannot build
against schema that isn't yet deployed. The `@mock` directive lets client
developers define and use mock responses for fields and types that are defined
locally but not yet present in the server schema, unblocking frontend
development.

## FAQs

### Can I use different mock values for different list positions?

This specification does not support conditional use of mock values in individual array
positions. You may, however, hoist usage of `@mock` to the parent node that returns
a list and return an array containing different values.

**Example**

Consider the following query:

```graphql
query PetStorePets {
  dogsForSale {
    name @mock(value: "fido")
  }
}
```

This might produce the following response:

```json
{
  "data": {
    "dogsForSale": [
      { "name": "fido" },
      { "name": "fido" },
      { "name": "fido" }
    ]
  }
}
```

For the purposes of a mock user interface, this might be ok! If you wanted to
change the value for each item in the list, you would need to mock at a higher
level:

```graphql
query PetStorePets {
  dogsForSale @mock(variant: "3-dogs-for-sale") {
    name
  }
}
```

#### Why isn't array position supported?

<details>
<summary>Details</summary>

A hypothetical `nth_child` argument (e.g. `@mock(value: "...", nth_child: 0)`)
would let clients target specific array positions. However, this introduces
several problems:

1. **Parent Ambiguity** — A mocked field may be nested under multiple list
   parents (e.g. `businessesNearMe[].menuItems[].blurHash`). It's unclear
   which list `nth_child` indexes into.

2. **Order Instability** — Server results may change order over time (e.g. a
   default sort changes), causing mock data to be merged into the wrong object
   and producing broken UI states.

3. **Abstract types** — When a list contains a union or interface, it's
   ambiguous whether `nth_child: 3` means "the third element overall" or "the
   third element of a specific concrete type." This is further complicated when
   the mocked field lives in a fragment that may be spread into both list and
   non-list contexts.

These issues are solvable in theory but add significant complexity. This version
of the specification does not support positional mocking.

</details>

### Why isn't @mock supported on inline fragments or fragment spreads?

`@mock` is not supported on inline fragments or fragment spreads:

```graphql
query Foo {
  barOrBaz {
    # not supported
    ... on Bar @mock(variant: "mock-bar") {
      hello
    }
    # not supported
    ... on Baz @mock(variant: "mock-baz") {
      world
    }
  }
  qux {
    # not supported
    ...QuxFields @mock(variant: "mock-qux")
  }
}
```

Instead, apply `@mock` to individual fields within the fragment:

```graphql
query Foo {
  barOrBaz {
    ... on Bar {
      hello @mock(value: "hi")
    }
    ... on Baz {
      world @mock(value: "earth")
    }
  }
}
```

<details>
<summary>Why not?</summary>

#### `__typename` dependency

Merging mock data for a type condition requires knowing which type the server
resolved. This means the client must rely on `__typename` being present in the
response. While common (especially with normalized caches), this is not
guaranteed — adding an implicit runtime dependency that field-level mocking
does not have.

#### Dead mock branches

When multiple type conditions have `@mock`, only the branch matching the
server's resolved type will trigger. The other mock variants exist in the mock
file but are dead code for that response. This makes it harder to validate that
mock data stays in sync with the operation over time, since stale mocks in
non-matching branches won't surface as errors.

#### Fragment spread precedence

For `...QuxFields @mock(variant: "mock-qux")`, the fragment `QuxFields` may
be defined in a separate file with its own mock file (`QuxFields.json`)
containing field-level `@mock` directives. It is unclear which mocks take
precedence — the spread-level mock or the individual field-level mocks inside
the fragment — creating a composition problem that does not exist with
field-level mocking.

</details>
