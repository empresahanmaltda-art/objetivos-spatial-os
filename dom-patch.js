(() => {
  'use strict';
  // Small keyed reconciler for quiet updates. Existing task cards, focused fields
  // and scroll containers keep their DOM identity instead of restarting animations.
  const key = (node) => node.nodeType === 1
    ? node.id || node.getAttribute('data-patch-key') || (node.hasAttribute('data-task-id')
      ? `task:${node.getAttribute('data-task-id')}:${node.getAttribute('data-task-date')}` : '') : '';
  const compatible = (left, right) => left.nodeType === right.nodeType
    && left.nodeName === right.nodeName && key(left) === key(right);

  function update(current, desired) {
    if (current.nodeType !== 1) {
      if (current.nodeValue !== desired.nodeValue) current.nodeValue = desired.nodeValue;
      return;
    }
    const focused = current.ownerDocument.activeElement === current;
    const drawerOpen = current.id === 'completedDrawer' && current.classList.contains('open');
    for (const attr of [...current.attributes]) {
      if (!desired.hasAttribute(attr.name)) current.removeAttribute(attr.name);
    }
    for (const attr of [...desired.attributes]) {
      if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
    }
    if (drawerOpen) current.classList.add('open');
    if (current.nodeName === 'INPUT' || current.nodeName === 'TEXTAREA') {
      if (!focused || desired.disabled) {
        if (current.value !== desired.value) current.value = desired.value;
      }
      current.checked = desired.checked;
      current.disabled = desired.disabled;
    } else {
      reconcile(current, desired);
    }
    if (drawerOpen) current.querySelector('.completed-toggle')?.setAttribute('aria-expanded', 'true');
  }

  function reconcile(parent, desired) {
    const remaining = new Set(parent.childNodes);
    const keyed = new Map([...remaining].filter(key).map((node) => [key(node), node]));
    let cursor = parent.firstChild;
    for (const next of [...desired.childNodes]) {
      let node = key(next) ? keyed.get(key(next)) : cursor;
      if (!node || !remaining.has(node) || !compatible(node, next)) {
        node = !key(next) ? [...remaining].find((candidate) => !key(candidate) && compatible(candidate, next)) : null;
      }
      if (!node) {
        node = next.cloneNode(true);
        parent.insertBefore(node, cursor);
      } else {
        remaining.delete(node);
        if (node !== cursor) parent.insertBefore(node, cursor);
        update(node, next);
      }
      cursor = node.nextSibling;
    }
    for (const node of remaining) node.remove();
  }

  globalThis.ObjetivosDOM = {
    patch(root, html) {
      const template = root.ownerDocument.createElement('template');
      template.innerHTML = html;
      reconcile(root, template.content);
    }
  };
})();
