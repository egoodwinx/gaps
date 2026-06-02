# @semanticNonNull Directive Specification

## Introduction

:: This document specifies the `@semanticNonNull` directive, a schema directive
that indicates a field position is _semantically non null_: it is only null when
there is a matching error in the response `errors` array, and is otherwise
guaranteed to contain a value.

GraphQL's Non-Null type (`!`) serves two purposes at once: it asserts that a
position can never logically be null, and it dictates that, when an error occurs
in that position during execution, the resulting null is _propagated_ to the
nearest nullable parent. Because error propagation can erase large amounts of
otherwise-valid data, API authors frequently make fields nullable purely to
contain the blast radius of field errors — even when those fields are, in the
absence of an error, always present.

`@semanticNonNull` lets a schema separate these two concerns. A field may remain
nullable on the wire (so that an error in it does not propagate) while still
declaring that, absent a matching error, the position always contains a value.

**Example**

```graphql example
type User {
  # `name` is nullable on the wire, but is only ever null if `name` itself
  # produced an error. Tooling may treat it as non-null otherwise.
  name: String @semanticNonNull

  # The list and each of its elements are semantically non null.
  friends: [User] @semanticNonNull(levels: [0, 1])
}
```

**Use Cases**

- Code generators may emit non-null types for semantically non-null positions
  when the client handles field errors through an out-of-band mechanism (such as
  a result type or an exception raised at the edge of the selection set), sparing
  developers from null checks on positions that are only ever null on error.
- Schema authors may keep fields nullable for resilience (so that field errors
  do not propagate and erase sibling data) without sacrificing the ability to
  communicate that those fields are, in practice, always present.

**Relationship to `onError`**

The [`onError` proposal](https://github.com/graphql/graphql-spec/pull/1163)
allows a client to opt out of error propagation (`onError: "NULL"`), so that a field error produces
a localized {null} rather than propagating up to the nearest nullable parent. Once
error propagation is no longer a concern, the _Non-Null_ type (`!`) can be used
to mark every position where {null} is not a semantically valid value — the true
nullability of the schema.

Representing that nullability with `!` is not always possible for existing services, however. Adding
`!` to an existing field may increase the blast radius of an error for clients that have not opted
out of error propagation.

`@semanticNonNull` addresses this. Because it is additive metadata that does not
change the wire type, a nullability-aware client may read the true nullability of
a field and omit its non-null checks, while clients that are unaware of the
directive observe the field exactly as before. `onError` and `@semanticNonNull`
describe the same underlying truth — which positions are truly non-null — but
`@semanticNonNull` can be adopted incrementally without affecting existing
clients.

## Definition

```graphql
directive @semanticNonNull(levels: [Int!]! = [0]) on FIELD_DEFINITION
```

The `@semanticNonNull` directive indicates that a field's result is
_semantically non null_ at the indicated _levels_.

A position is _semantically non null_ if it is only {null} when there is a
matching error in the `errors` array of the response. In all other cases, the
position contains a value.

`@semanticNonNull` may only be applied to a _FieldDefinition_ whose type is
nullable at the indicated _levels_. Applying it to a position that is already a
_Non-Null_ type at that level is meaningless (the position is already
guaranteed non-null by the type system) and must be considered an error.

## The levels argument

The _levels_ argument selects which _levels_ of a (possibly nested) _List_ type
are semantically non null. Levels are zero-indexed, where level {0} is the
outermost position (the field's own value).

- For a non-list type, only level {0} is meaningful, and it refers to the
  field's value itself.
- For a _List_ type, level {0} refers to the list itself, level {1} refers to
  each element of the list, level {2} to each element of each nested list, and
  so on.

The default value of `[0]` makes only the outermost position semantically non
null, matching the common case of a non-list field.

A _level_ that is negative, or that exceeds the list dimensionality of the
annotated field, must be considered an error.

**Examples**

Given the field type {"[[String]]"}:

| Application                           | Semantically non-null positions                    |
| ------------------------------------- | -------------------------------------------------- |
| `@semanticNonNull`                    | the outer list                                     |
| `@semanticNonNull(levels: [1])`       | each inner list                                    |
| `@semanticNonNull(levels: [2])`       | each {String} element                              |
| `@semanticNonNull(levels: [0, 1, 2])` | the outer list, each inner list, and each {String} |

```graphql example
type Query {
  # The list itself is semantically non null; individual elements may be null.
  tags: [String] @semanticNonNull

  # Both the list and each element are semantically non null.
  ids: [ID] @semanticNonNull(levels: [0, 1])
}
```
