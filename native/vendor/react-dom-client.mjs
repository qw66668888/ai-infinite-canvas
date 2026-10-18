const ReactDOM = window.ReactDOM;
if (!ReactDOM) throw new Error("ReactDOM UMD 没有加载");
export function createRoot(container, options) {
  return ReactDOM.createRoot(container, options);
}
export function hydrateRoot(container, element, options) {
  return ReactDOM.hydrateRoot(container, element, options);
}
export default { createRoot, hydrateRoot };
