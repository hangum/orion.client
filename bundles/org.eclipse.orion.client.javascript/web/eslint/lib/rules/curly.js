/*******************************************************************************
 * @license
 * Copyright (c) 2014 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License v1.0
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html).
 *
 * Contributors:
 *	 IBM Corporation - initial API and implementation
 *******************************************************************************/
/*eslint-env amd, node */
(function(root, factory) {
	if(typeof exports === 'object') {  //$NON-NLS-0$
		module.exports = factory(require, exports, module);
	}
	else if(typeof define === 'function' && define.amd) {  //$NON-NLS-0$
		define(['require', 'exports', 'module', 'logger'], factory);
	}
	else {
		var req = function(id) {return root[id];},
			exp = root,
			mod = {exports: exp};
		root.rules.noundef = factory(req, exp, mod);
	}
}(this, function(require, exports, module, Logger) {
	/**
	 * @name module.exports
	 * @description Exported rule
	 * @function
	 * @param context
	 * @returns {Object} Exported AST nodes to lint
	 */
	module.exports = function(context) {
		"use strict";  //$NON-NLS-0$
		
		/**
		 * Checks the following AST element for a BlockStatement
		 * @param {Object} node The AST node to check
		 */
		function checkBlock(node) {
			try {
				if(node.type === 'IfStatement') {
					if(node.consequent && node.consequent.type !== 'BlockStatement') {
						//flag the first token of the statement that should be in the block
						context.report(node.consequent, "Statement should be enclosed in braces.", null, context.getTokens(node.consequent)[0]);
					}
					if(node.alternate && node.alternate.type !== 'BlockStatement' && node.alternate.type !== 'IfStatement') {
						//flag the first token of the statement that should be in the block
						context.report(node.alternate, "Statement should be enclosed in braces.", null, context.getTokens(node.alternate)[0]);
					}
				} else if(node.type === 'WhileStatement' || node.type === 'ForStatement' || node.type === 'ForInStatement') {
					if(node.body && node.body.type !== 'BlockStatement') {
						//flag the first token of the statement that should be in the block
						context.report(node.body, "Statement should be enclosed in braces.", null, context.getTokens(node.body)[0]);
					}
				}
			}
			catch(ex) {
				Logger.log(ex);
			}
		}
		
		return {
			'IfStatement' : checkBlock,
			'WhileStatement' : checkBlock,
			'ForStatement' : checkBlock,
			'ForInStatement' : checkBlock
		};
	};
	return module.exports;
}));
