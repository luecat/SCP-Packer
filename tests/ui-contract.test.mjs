import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('the page exposes only user-facing GGR inputs and module runtime', () => {
  for (const id of ['usc', 'bgm', 'cover', 'pack']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.doesNotMatch(html, /id=["']metadata["']/);
  assert.match(html, /<script\s+type="module"\s+src="app\.js"><\/script>/);
  assert.doesNotMatch(html, /\.scp|sonolus-engine-template/);
});

test('SCP-only resources are removed and README documents GGR', () => {
  assert.equal(existsSync(new URL('../assets/sonolus-engine-template.scp', import.meta.url)), false);
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  for (const text of ['Gugarythm Packer', '.ggr', 'chart.usc', 'metadata.json', 'cover']) assert.match(readme, new RegExp(text.replace('.', '\\.')));
});
