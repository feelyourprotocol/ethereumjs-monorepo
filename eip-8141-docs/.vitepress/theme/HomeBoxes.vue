<template>
  <div class="home-boxes">
    <a href="/about" class="box box-beep">
      <span class="box-icon">🤖</span>
      <div class="box-content">
        <strong>Beep Boop — AI-Generated Docs</strong>
        <p>
          Fully AI-generated as a human-AI experiment. May contain
          inaccuracies — always cross-reference with the
          <em>actual EIP</em>. Live lab notebook, not polished manual.
        </p>
      </div>
    </a>
    <a href="/doc-updates" class="box box-date">
      <span class="box-icon">📅</span>
      <div class="box-content">
        <strong>Last Updated: March 18, 2026</strong>
        <p>
          EIP version:
          <code>ee66073</code> (March 13, 2026). Docs update quasi-daily —
          see <em>Doc Updates</em> for what's new.
        </p>
      </div>
    </a>
  </div>
</template>

<style scoped>
.home-boxes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  max-width: 1152px;
  margin: 0 auto 0;
  padding: 0 24px 40px;
}

@media (max-width: 640px) {
  .home-boxes {
    grid-template-columns: 1fr;
  }
}

.box {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 20px;
  border-radius: 12px;
  text-decoration: none;
  transition: border-color 0.25s, box-shadow 0.25s;
}

.box:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.box-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
  margin-top: 2px;
}

.box-content strong {
  display: block;
  font-size: 0.95rem;
  margin-bottom: 4px;
}

.box-content p {
  font-size: 0.85rem;
  margin: 0;
  line-height: 1.5;
  opacity: 0.85;
}

.box-content code {
  font-size: 0.8rem;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.05);
}

.box-beep {
  background: rgba(208, 58, 82, 0.08);
  border: 1px solid rgba(208, 58, 82, 0.3);
  color: inherit;
}

.box-beep:hover {
  border-color: rgba(208, 58, 82, 0.5);
}

.box-beep strong {
  color: var(--vp-c-danger-1);
}

.box-date {
  background: rgba(60, 130, 246, 0.08);
  border: 1px solid rgba(60, 130, 246, 0.3);
  color: inherit;
}

.box-date:hover {
  border-color: rgba(60, 130, 246, 0.5);
}

.box-date strong {
  color: var(--vp-c-brand-1);
}
</style>
