/* @refresh reload */
import {
  Component,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  Index,
  ParentComponent,
  Show,
  useContext,
} from 'solid-js';
import { produce as solidProduce } from 'solid-js/store';
import { render } from 'solid-js/web';
export const produce = solidProduce;
const storeCtx = createContext({} as any);

const useStore = () => useContext(storeCtx);

export const Serialize = ({ node }: any) => {
  if (Array.isArray(node())) {
    return <Index each={node()}>{(n) => <Serialize node={n} />}</Index>;
  }
  if (node().type !== 'div') {
    if (node().italic) return <em>{node().text}</em>;
    if (node().underScore) return <u>{node().text}</u>;
    return <span>{node().text}</span>;
  }

  return (
    <div>
      <Index each={node().children}>{(n) => <Serialize node={n} />}</Index>
    </div>
  );
};

const makeEditmodeProps = ({ id, type }: any, isSection = false) => ({
  'data-pe-type': isSection ? type : `ELEMENT-${type}`,
  'data-pe-id': id,
});

export const Content = ({ content }: any) => {
  let ref: HTMLElement;
  createEffect(() => {
    content();
    ref.innerHTML = '';
    render(() => <Serialize node={content} />, ref);
  });
  return <div data-pe-content ref={(el) => (ref = el)} />;
};

export const Button: Component<any> = (props) => {
  const store = useStore();
  const data = createMemo(() => {
    return store().blockMap[props.id];
  });
  const content = createMemo(() => {
    return data().content;
  });
  return (
    <button
      {...(store().isEditMode ? makeEditmodeProps(data()) : {})}
      style={{ 'grid-area': props.id }}
    >
      <Content content={content} />
    </button>
  );
};

export const Text: Component<any> = (props) => {
  const store = useStore();
  const data = createMemo(() => {
    return store().blockMap[props.id];
  });
  const content = createMemo(() => {
    return data().content;
  });
  return (
    <div
      {...(store().isEditMode ? makeEditmodeProps(data()) : {})}
      style={{ background: 'rgba(230,20,40,0.2)', 'grid-area': props.id }}
    >
      <Content content={content} />
    </div>
  );
};

export const Section: ParentComponent<{ layout: string[][]; id: string }> = (
  data,
) => {
  const store = useStore();
  const template = [...data.layout.map((row) => `"${row.join(' ')}"`)].join(
    '\n',
  );
  return (
    <div
      {...(store().isEditMode ? makeEditmodeProps(data, true) : {})}
      style={{
        display: 'grid',
        'grid-template-areas': template,
        gap: '10px',
        'grid-template-columns': 'repeat(12, 1fr)',
        padding: '10px',
      }}
    >
      {data.children}
    </div>
  );
};

export const Page: ParentComponent<{}> = ({ children }) => {
  return <div>{children}</div>;
};

const ElementTypes = ['BUTTON', 'TEXT'];
// DFS
export const Renderer: Component<{ data: any }> = ({ data }) => {
  const store = useStore();
  const children = ElementTypes.includes(data.type) ? null : (
    <Index each={data.children}>
      {(id) => <Renderer data={store().blockMap[id() as string]} />}
    </Index>
  );
  switch (data.type) {
    case 'BUTTON':
      return <Button {...data} />;
    case 'TEXT':
      return <Text {...data} />;
    case 'PAGE':
      return <Page>{children}</Page>;
    case 'SECTION':
      return <Section {...data}>{children}</Section>;
    default:
      return null;
  }
};

const App = () => {
  const store = useStore();
  return (
    <Show when={store().blockMap?.page}>
      <Renderer data={store().blockMap.page} />
    </Show>
  );
};

export const renderC = (el: HTMLElement) => {
  const [store, setStore] = createSignal<any>({
    blockMap: {},
    isEditMode: false,
  });
  render(
    () => (
      <storeCtx.Provider value={store}>
        <App />
      </storeCtx.Provider>
    ),
    el,
  );
  return setStore;
};
