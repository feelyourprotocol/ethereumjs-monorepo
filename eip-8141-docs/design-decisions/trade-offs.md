# Trade-offs

*Status: Planned — trade-offs will be documented here as the implementation progresses.*

This page captures the trade-offs we encounter and how we navigate them. Unlike architecture decisions (which have clear options and a chosen path), trade-offs are ongoing tensions that influence many decisions.

## Anticipated Trade-offs

### Spec Fidelity vs. Pragmatic Implementation

The spec describes behavior at a high level. A reference implementation has to make choices about internal representation that the spec doesn't prescribe. We aim for:

- **Behavior-identical** with the spec in all observable outcomes
- **Pragmatic** in internal implementation where the spec is silent
- **Explicit** about where we made assumptions

### Performance vs. Clarity

As a reference implementation, **clarity takes priority over performance**. This means:

- Preferring straightforward data structures over optimized ones
- Adding explicit validation checks even where they're technically redundant
- Keeping the frame execution loop simple and readable

That said, we won't write intentionally slow code. The goal is "fast enough to be useful, clear enough to be educational."

### Strictness vs. Flexibility

Where the spec is ambiguous, we can either:

- **Be strict** — reject anything not explicitly allowed (safer, catches spec issues early)
- **Be flexible** — accept reasonable interpretations (more compatible, fewer false rejections)

Our approach: **be strict during development** (to surface spec ambiguities) and **document where we'd loosen** if the spec clarifies.

### Backwards Compatibility vs. Clean Design

The EthereumJS codebase has established patterns and APIs. Frame transactions challenge some of these (e.g., "every transaction has a signature"). We need to balance:

- **Reusing existing infrastructure** where it fits
- **Breaking from convention** where forcing the fit would create worse abstractions
- **Minimizing changes to shared code** that could affect other transaction types

## Documented Trade-offs

*Trade-off entries will be added here as they arise during implementation.*
