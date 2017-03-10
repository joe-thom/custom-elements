import CustomElementInternals from '../../CustomElementInternals.js';
import * as Utilities from '../../Utilities.js';

/**
 * @typedef {{
 *   before: !function(...(!Node|string)),
 *   after: !function(...(!Node|string)),
 *   replaceWith: !function(...(!Node|string)),
 *   remove: !function(),
 * }}
 */
let ChildNodeNativeMethods;

/**
 * @param {!CustomElementInternals} internals
 * @param {!Object} destination
 * @param {!ChildNodeNativeMethods} builtIn
 */
export default function(internals, destination, builtIn) {
  /**
   * @param {!function(...(!Node|string))} builtInMethod
   * @return {!function(...(!Node|string))}
   */
  function beforeAfterPatch(builtInMethod) {
    return function(...nodes) {
      /**
       * A copy of `nodes`, with any DocumentFragment replaced by its children.
       * @type {!Array<!Node>}
       */
      const flattenedNodes = [];

      /**
       * Elements in `nodes` that were connected before this call.
       * @type {!Array<!Node>}
       */
      const connectedElements = [];

      for (var i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        if (node instanceof Element && Utilities.isConnected(node)) {
          connectedElements.push(node);
        }

        if (node instanceof DocumentFragment) {
          for (let child = node.firstChild; child; child = child.nextSibling) {
            flattenedNodes.push(child);
          }
        } else {
          flattenedNodes.push(node);
        }
      }

      builtInMethod.apply(this, nodes);

      for (let i = 0; i < connectedElements.length; i++) {
        internals.disconnectTree(connectedElements[i]);
      }

      if (Utilities.isConnected(this)) {
        for (let i = 0; i < flattenedNodes.length; i++) {
          const node = flattenedNodes[i];
          if (node instanceof Element) {
            internals.connectTree(node);
          }
        }
      }
    };
  }

  Utilities.setPropertyUnchecked(destination, 'before', beforeAfterPatch(builtIn.before));
  Utilities.setPropertyUnchecked(destination, 'after', beforeAfterPatch(builtIn.after));

  Utilities.setPropertyUnchecked(destination, 'replaceWith',
    /**
     * @param {...(!Node|string)} nodes
     */
    function(...nodes) {
      // TODO: Fix this for when one of `nodes` is a DocumentFragment!
      const connectedBefore = /** @type {!Array<!Node>} */ (nodes.filter(node => {
        // DocumentFragments are not connected and will not be added to the list.
        return node instanceof Node && Utilities.isConnected(node);
      }));

      const wasConnected = Utilities.isConnected(this);

      builtIn.replaceWith.apply(this, nodes);

      for (let i = 0; i < connectedBefore.length; i++) {
        internals.disconnectTree(connectedBefore[i]);
      }

      if (wasConnected) {
        internals.disconnectTree(this);
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (node instanceof Element) {
            internals.connectTree(node);
          }
        }
      }
    });

  Utilities.setPropertyUnchecked(destination, 'remove',
    function() {
      const wasConnected = Utilities.isConnected(this);

      builtIn.remove.call(this);

      if (wasConnected) {
        internals.disconnectTree(this);
      }
    });
};
