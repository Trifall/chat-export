import { extractFormattedText } from '../src/modules/content-handlers';
import { expect, test } from '@playwright/test';

class FakeNode {
  parentElement: FakeElement | null = null;
  childNodes: FakeNode[] = [];

  constructor(
    public nodeName: string,
    public nodeType: number,
    public textContent = ''
  ) {}
}

class FakeElement extends FakeNode {
  tagName: string;
  className = '';
  classList = { contains: () => false };

  constructor(tagName: string) {
    super(tagName, 1);
    this.tagName = tagName;
  }

  get children(): FakeNode[] {
    return this.childNodes.filter((child) => child.nodeType === 1);
  }

  querySelector(): null {
    return null;
  }

  querySelectorAll(): FakeElement[] {
    return [];
  }

  getAttribute(): null {
    return null;
  }
}

class FakeText extends FakeNode {
  constructor(text: string) {
    super('#text', 3, text);
  }
}

function textCell(tagName: string, text: string): FakeElement {
  const cell = new FakeElement(tagName);
  const textNode = new FakeText(text);
  textNode.parentElement = cell;
  cell.childNodes = [textNode];
  return cell;
}

test('renders simple tables as markdown', async () => {
  const originalElement = globalThis.Element;
  const originalNode = globalThis.Node;
  Object.assign(globalThis, { Element: FakeElement, Node: { TEXT_NODE: 3 } });

  try {
    const table = new FakeElement('TABLE');
    const header = new FakeElement('TR');
    const body = new FakeElement('TR');
    const app = new FakeElement('STRONG');
    const appText = new FakeText('Your SvelteKit App');
    appText.parentElement = app;
    app.childNodes = [appText];
    const port = new FakeElement('CODE');
    port.textContent = 'PORT';
    const example = new FakeElement('TD');
    const exampleText = new FakeText('Always 3000 (or ');
    const exampleEnd = new FakeText(' env var)');
    exampleText.parentElement = example;
    port.parentElement = example;
    exampleEnd.parentElement = example;
    example.childNodes = [exampleText, port, exampleEnd];

    header.childNodes = [
      textCell('TH', 'Layer'),
      textCell('TH', 'Port Setting'),
      textCell('TH', 'Example'),
    ];
    header.childNodes.forEach((child) => {
      child.parentElement = header;
    });
    app.parentElement = body;
    const appCell = new FakeElement('TD');
    appCell.childNodes = [app];
    body.childNodes = [appCell, textCell('TD', 'Internal app port'), example];
    body.childNodes.forEach((child) => {
      child.parentElement = body;
    });
    table.querySelectorAll = () => [header, body];

    await expect(extractFormattedText(table as unknown as Element)).resolves.toBe(
      'Layer | Port Setting | Example\n' +
        '--- | --- | ---\n' +
        '**Your SvelteKit App** | Internal app port | Always 3000 (or `PORT` env var)'
    );
  } finally {
    Object.assign(globalThis, { Element: originalElement, Node: originalNode });
  }
});

test('keeps spaces around inline formatting', async () => {
  const originalElement = globalThis.Element;
  const originalNode = globalThis.Node;
  Object.assign(globalThis, { Element: FakeElement, Node: { TEXT_NODE: 3 } });

  try {
    const paragraph = new FakeElement('P');
    const before = new FakeText('Docker captures ');
    const strong = new FakeElement('STRONG');
    strong.textContent = 'stdout/stderr';
    const after = new FakeText(' automatically');
    paragraph.childNodes = [before, strong, after];
    paragraph.childNodes.forEach((child) => {
      child.parentElement = paragraph;
    });

    await expect(extractFormattedText(paragraph as unknown as Element)).resolves.toBe(
      'Docker captures **stdout/stderr** automatically'
    );
  } finally {
    Object.assign(globalThis, { Element: originalElement, Node: originalNode });
  }
});

test('skips aria-hidden subtrees', async () => {
  const originalElement = globalThis.Element;
  const originalNode = globalThis.Node;
  Object.assign(globalThis, { Element: FakeElement, Node: { TEXT_NODE: 3 } });

  try {
    const container = new FakeElement('DIV');
    const glyph = new FakeElement('SPAN');
    glyph.getAttribute = () => 'true';
    const label = new FakeText('typescript');
    container.childNodes = [glyph, label];
    container.childNodes.forEach((child) => {
      child.parentElement = container;
    });

    await expect(extractFormattedText(container as unknown as Element)).resolves.toBe('typescript');
  } finally {
    Object.assign(globalThis, { Element: originalElement, Node: originalNode });
  }
});

test('strips code block headers from fences', async () => {
  const originalElement = globalThis.Element;
  const originalNode = globalThis.Node;
  Object.assign(globalThis, { Element: FakeElement, Node: { TEXT_NODE: 3 } });

  try {
    const pre = new FakeElement('PRE');
    const header = new FakeElement('DIV');
    const headerLabel = new FakeText('typescript');
    headerLabel.parentElement = header;
    header.childNodes = [headerLabel];
    const code = new FakeElement('CODE');
    code.className = 'language-typescript';
    const codeText = new FakeText('x = 1');
    codeText.parentElement = code;
    code.childNodes = [codeText];
    pre.childNodes = [header, code];
    pre.childNodes.forEach((child) => {
      child.parentElement = pre;
    });
    pre.querySelector = (selector: string) => (selector === 'code' ? code : null);

    await expect(extractFormattedText(pre as unknown as Element)).resolves.toBe(
      '```typescript\nx = 1\n```'
    );
  } finally {
    Object.assign(globalThis, { Element: originalElement, Node: originalNode });
  }
});

test('renders markdown code blocks without their headers', async () => {
  const originalElement = globalThis.Element;
  const originalNode = globalThis.Node;
  Object.assign(globalThis, { Element: FakeElement, Node: { TEXT_NODE: 3 } });

  try {
    const block = new FakeElement('DIV');
    block.getAttribute = () => 'code-block';
    const header = new FakeElement('DIV');
    header.textContent = 'TypeScript';
    header.querySelector = () => null;
    const code = new FakeElement('CODE');
    const codeText = new FakeText('const x = 1');
    codeText.parentElement = code;
    code.childNodes = [codeText];
    block.childNodes = [header, code];
    block.childNodes.forEach((child) => {
      child.parentElement = block;
    });
    block.querySelector = (selector: string) => {
      if (selector === 'code') return code;
      if (selector.includes('exclude')) return header;
      return null;
    };

    await expect(extractFormattedText(block as unknown as Element)).resolves.toBe(
      '```TypeScript\nconst x = 1\n```'
    );
  } finally {
    Object.assign(globalThis, { Element: originalElement, Node: originalNode });
  }
});

test('skips excluded subtrees', async () => {
  const originalElement = globalThis.Element;
  const originalNode = globalThis.Node;
  Object.assign(globalThis, { Element: FakeElement, Node: { TEXT_NODE: 3 } });

  try {
    const container = new FakeElement('DIV');
    const excluded = new FakeElement('DIV');
    excluded.getAttribute = () => 'exclude';
    const excludedText = new FakeText('Copy');
    excludedText.parentElement = excluded;
    excluded.childNodes = [excludedText];
    const visible = new FakeText('hello');
    visible.parentElement = container;
    container.childNodes = [excluded, visible];

    await expect(extractFormattedText(container as unknown as Element)).resolves.toBe('hello');
  } finally {
    Object.assign(globalThis, { Element: originalElement, Node: originalNode });
  }
});

test('skips sr-only subtrees', async () => {
  const originalElement = globalThis.Element;
  const originalNode = globalThis.Node;
  Object.assign(globalThis, { Element: FakeElement, Node: { TEXT_NODE: 3 } });

  try {
    const container = new FakeElement('DIV');
    const hidden = new FakeElement('H4');
    hidden.classList = { contains: () => true };
    const hiddenText = new FakeText('ChatGPT said:');
    hiddenText.parentElement = hidden;
    hidden.childNodes = [hiddenText];
    const visible = new FakeText('hello');
    visible.parentElement = container;
    container.childNodes = [hidden, visible];

    await expect(extractFormattedText(container as unknown as Element)).resolves.toBe('hello');
  } finally {
    Object.assign(globalThis, { Element: originalElement, Node: originalNode });
  }
});

test('separates list items and blocks with newlines', async () => {
  const originalElement = globalThis.Element;
  const originalNode = globalThis.Node;
  Object.assign(globalThis, { Element: FakeElement, Node: { TEXT_NODE: 3 } });

  try {
    const list = new FakeElement('UL');
    const first = new FakeElement('LI');
    const firstText = new FakeText('first');
    firstText.parentElement = first;
    first.childNodes = [firstText];
    const second = new FakeElement('LI');
    const secondText = new FakeText('second');
    secondText.parentElement = second;
    second.childNodes = [secondText];
    list.childNodes = [first, second];
    list.childNodes.forEach((child) => {
      child.parentElement = list;
    });

    await expect(extractFormattedText(list as unknown as Element)).resolves.toBe(
      '- first\n- second'
    );
  } finally {
    Object.assign(globalThis, { Element: originalElement, Node: originalNode });
  }
});
