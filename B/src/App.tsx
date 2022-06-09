import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal, unmountComponentAtNode } from 'react-dom';
import { createEditor, Descendant, Editor } from 'slate';
import { jsx } from 'slate-hyperscript';
import {
  Editable,
  RenderElementProps,
  RenderLeafProps,
  Slate,
  withReact,
} from 'slate-react';
import { renderC, produce } from '../../C/dist';

const defaultData = {
  page: {
    id: 'page',
    type: 'PAGE',
    children: ['section0'],
  },
  section0: {
    id: 'section0',
    type: 'SECTION',
    layout: [[...new Array(6).fill('text0'), ...new Array(6).fill('button0')]],
    children: ['button0', 'text0'],
  },
  button0: {
    id: 'button0',
    type: 'BUTTON',
    content: [
      {
        type: 'div',
        children: [{ text: 'I am a button', italic: false, underScore: false }],
      },
    ],
  },
  text0: {
    id: 'text0',
    type: 'TEXT',
    content: [
      {
        type: 'div',
        children: [
          {
            text: 'I am not a button',
            type: 'text',
            italic: false,
            underScore: false,
          },
        ],
      },
    ],
  },
};

const Leaf = ({ attributes, leaf, children }: RenderLeafProps) => {
  if (leaf.italic) children = <em>{children}</em>;
  if (leaf.underScore) children = <u>{children}</u>;

  return <span {...attributes}>{children}</span>;
};

const renderLeaf = (props: RenderLeafProps) => {
  return <Leaf {...props} />;
};

const renderElement = ({ children }: RenderElementProps) => (
  <div>{children}</div>
);
const deserialize = (el: any): any => {
  if (['#text', 'EM', 'U', 'SPAN'].includes(el.nodeName)) {
    return jsx(
      'text',
      {
        type: 'text',
        italic: el.nodeName === 'EM',
        underScore: el.nodeName === 'U',
      },
      el.textContent || '',
    );
  }
  if (el.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }
  const children = Array.from(el.childNodes)
    .map((node) => deserialize(node as Element))
    .flat() as Descendant[];
  return jsx('element', { type: 'div' }, children);
};

function App() {
  const [editor] = useState(() => withReact(createEditor()));
  const [slateState, _setSlateState] = useState<Descendant[]>([]);
  const slateStateRef = useRef(slateState);
  const setSlateState = (value: any) => {
    _setSlateState(value);
    slateStateRef.current = value;
  };
  const editEl = useRef<HTMLElement | null>(null);
  const contentEl = useRef<HTMLElement | null>(null);
  const storeRef = useRef<any>();

  const handleClick = (el: HTMLElement) => {
    if (editEl.current?.parentElement?.dataset.peId === el.dataset.peId) return;
    editEl.current = el;
    contentEl.current = el.querySelector('[data-pe-content]') as HTMLDivElement;

    const json = [];
    for (let item of contentEl.current.childNodes) {
      const res = deserialize(item);
      json.push(res);
    }

    setSlateState(json ? json : []);

    contentEl.current.style.cssText = `
    position: absolute !important;
      top: 0;
      opacity: 0 !important;
      clip: rect(1px, 1px, 1px, 1px) !important;
      overflow: hidden !important;
      height: 1px !important;
      width: 1px !important;
      padding: 0 !important;
      border: 0 !important;
      `;
    const editorEl = document.createElement('div');

    el.appendChild(editorEl);
    editEl.current = editorEl;

    document.addEventListener('click', (e: any) => {
      const id = el.dataset.peId!;
      if (
        editEl.current &&
        !(e.target as any)?.closest(`[data-pe-id="${id}"]`) &&
        !(e.target as any)?.closest(`#editor-toobar`)
      ) {
        el?.removeChild(editEl.current!);
        editEl.current = null;
        storeRef.current((prev: any) => ({
          ...prev,
          blockMap: {
            ...prev.blockMap,
            [id]: {
              ...prev.blockMap[id],
              content: slateStateRef.current,
            },
          },
        }));
        setSlateState([]);
        contentEl.current!.style.cssText = '';
        contentEl.current = null;
      }
    });
  };

  const previewRef = useCallback((el: HTMLDivElement) => {
    storeRef.current = renderC(el);
    storeRef.current((prev: any) => ({
      ...prev,
      blockMap: defaultData,
      isEditMode: true,
    }));

    const elements = document.querySelectorAll(
      '[data-pe-type|="ELEMENT"]',
    ) as NodeListOf<HTMLElement>;
    elements.forEach((el) => {
      el.addEventListener('click', () => handleClick(el));
    });

    const indicator = document.createElement('div');
    document.body.appendChild(indicator);
    let isMouseDown = false;
    el.addEventListener('mousedown', () => (isMouseDown = true));
    el.addEventListener('mouseup', () => (isMouseDown = false));
    el.addEventListener('mousemove', (e) => {
      // reset
      document.body.style.cursor = 'unset';
      indicator.style.display = 'none';

      const parentSection = (e.target as HTMLElement)?.closest(
        '[data-pe-type="SECTION"]',
      );
      if (!parentSection) return;

      const parentRect = parentSection.getBoundingClientRect();
      const padding = 10;
      if (
        e.clientY < parentRect.top + padding ||
        e.clientY > parentRect.bottom - padding
      )
        return;

      const nearest: Record<
        'left' | 'right',
        {
          value: number;
          elementVal: number | null;
        }
      > = {
        left: {
          value: Infinity,
          elementVal: null,
        },
        right: {
          value: Infinity,
          elementVal: null,
        },
      };
      for (const ele of elements) {
        const rect = ele.getBoundingClientRect();

        const diffLeft = rect.left - e.clientX;
        if (diffLeft > 0 && diffLeft < nearest.right.value) {
          nearest.right.value = diffLeft;
          nearest.right.elementVal = rect.left;
          continue;
        }

        const diffRight = e.clientX - rect.right;
        if (diffRight > 0 && diffRight < nearest.left.value) {
          nearest.left.elementVal = rect.right;
          nearest.left.value = diffRight;
        }
      }
      if (nearest.left.elementVal === null || nearest.right.elementVal === null)
        return;

      document.body.style.cursor = 'col-resize';
      const midX =
        nearest.left.elementVal +
        (nearest.right.elementVal - nearest.left.elementVal) / 2;
      const width = 2;
      const topY = parentRect.top + padding - width / 2;
      const height = parentRect.bottom - padding - topY;

      indicator.style.cssText = `
        position: absolute;
        top: ${topY}px;
        left: ${midX}px;
        height: ${height}px;
        width: ${width}px;
        background: blue;
        display: block;
        `;
    });
  }, []);
  return (
    <div className="App">
      <div id="editor-toobar">
        <button
          onClick={() => {
            const marks = Editor.marks(editor);
            if (marks?.italic === true) {
              Editor.removeMark(editor, 'italic');
            } else {
              Editor.addMark(editor, 'italic', true);
            }
          }}
        >
          Italic
        </button>
        <button
          onClick={() => {
            const marks = Editor.marks(editor);
            if (marks?.underScore === true) {
              Editor.removeMark(editor, 'underScore');
            } else {
              Editor.addMark(editor, 'underScore', true);
            }
          }}
        >
          Underscore
        </button>
      </div>
      <div id="preview" ref={previewRef} />
      {editEl.current &&
        createPortal(
          <Slate editor={editor} value={slateState} onChange={setSlateState}>
            <Editable
              autoFocus
              renderElement={renderElement}
              renderLeaf={renderLeaf}
            />
          </Slate>,
          editEl.current,
        )}
    </div>
  );
}

export default App;
