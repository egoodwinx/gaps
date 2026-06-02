# GAP-0: @semanticNonNull Directive

## Overview

This proposal defines the `@semanticNonNull` directive, a schema directive that
marks a field position as _semantically non null_: the position is guaranteed to
contain a value unless there is a matching error in the response's `errors`
array.

This separates two concepts that GraphQL's `!` (Non-Null) type conflates:

- **"this position can never logically be null"** (semantic nullability), and
- **"this position becomes null when the field errors"** (error nullability).

By expressing semantic nullability separately, code generation tools can emit
non-null types for clients that can opt-out of error propagation with `onError: NULL`, removing the unnecessary null checks that
clients would otherwise have to write.

## Relationship to prior art

This directive is part of the broader
[GraphQL Nullability specification](https://specs.apollo.dev/nullability/) being
developed in the
[GraphQL Nullability Working Group](https://github.com/graphql/nullability-wg).
The full nullability specification also defines client-side directives
(`@catch`, `@catchByDefault`) describing how clients handle field errors. This
GAP scopes itself to the schema-side `@semanticNonNull` (and the companion
`@semanticNonNullField`) directive, which is independently useful and can be
adopted on its own.

Related discussions and prior art:

- [GraphQL Nullability WG](https://github.com/graphql/nullability-wg)
- [graphql-spec #1452 — "Client Controlled Nullability"](https://github.com/graphql/graphql-spec/pull/1452)
  and the broader nullability discussions in the GraphQL specification.
- [`specs.apollo.dev/nullability/v0.4`](https://specs.apollo.dev/nullability/v0.4/#@semanticNonNull).
