/*eslint-env browser */
/*eslint no-unused-params:0 */
/*global $ */

// @returns A Promise resolving with the parsed application
function appxhr(method, url, appData) {
	if (appData) {
		appData = JSON.stringify(appData);
	}
	return $.ajax(url, {
		type: method,
		contentType: "application/json",
		data: appData,
		processData: false, // don't do any query-string hackery with body
	}).then(function(result, state, xhr) {
		var text = xhr.responseText, app = parseApp(text);
		if (app) {
			return app;
		}
		return new $.Deferred().reject(new Error(text)).promise();
	});
}

function parseApp(responseText) {
	try {
		return JSON.parse(responseText);
	} catch (e) {
		return null;
	}
}

function log() {
	if (typeof console !== "undefined")
		console.log.apply(console, arguments);
}

function replaceSubtree(node, messages) {
	function processNodes(node, replace) {
		if (node.nodeType === 3) { // TEXT_NODE
			var matches = /\$\{([^\}]+)\}/.exec(node.nodeValue);
			if (matches && matches.length > 1) {
				replace(node, matches);
			}
		}
		if (node.hasChildNodes()) {
			for (var i=0; i<node.childNodes.length; i++) {
				processNodes(node.childNodes[i], replace);
			}
		}
	}
	processNodes(node, function(targetNode, matches) {
		var replaceText = messages[matches[1]] || matches[1];
		targetNode.parentNode.replaceChild(document.createTextNode(replaceText), targetNode);
	});
}

var control = {
	app: null,
	breakOnStart: false,
	get: function() {
		return this._withapp(appxhr("GET", "apps/"));
	},
	stop: function() {
		return this._changeState("stop");
	},
	debug: function(breakOnStart) {
		return this._changeState(breakOnStart ? "debugbreak" : "debug");
	},
	_changeState: function(newState) {
		var app = this.app;
		app.state = newState;
		return this._withapp(appxhr("PUT", "apps/" + encodeURIComponent(app.name), app));
	},
	_withapp: function(appxhr) {
		var _self = this;
		return appxhr.then(function(app) {
			_self.app = app;
			return app;
		});
	},
};

var view = {
	render: function() {
		var panel = $("#app-status-panel");
		var app = control.app,
		    isDebugging = (app.state === "debug" || app.state === "debugbreak"),
		    template = isDebugging ? $("#template-debug") : $("#template-stop"),
		    status = template.clone(true);
		replaceSubtree(status[0], {
			name: app.name
		});
		panel.empty().append(status);
		$("#logtail").text(app.tail.join("\n"));
		this.bind();
	},
	renderErr: function(err) {
		$("#app-status-panel").text(err && err.toString());
	},
	bind: function() {
		var panel = $("#app-status-panel");
		$("#btn-stop", panel).click(function() {
			control.stop().then(view.render.bind(view));
		});
		$("#btn-break", panel).click(function() {
			control.breakOnStart = true;
		});
		$("#btn-no-break", panel).click(function() {
			control.breakOnStart = false;
		});
		$("#btn-start, #btn-restart", panel).click(function() {
			var dialog = $("#startPrompt").modal("show");
			dialog.on("hide.bs.modal", function() {
				log("starting app, --debug-brk: " + control.breakOnStart);
				control.debug(control.breakOnStart).then(view.render.bind(view));
			});
		});
	}
};

function init() {
	control.get().then(view.render.bind(view), view.renderErr.bind(view));
}

document.addEventListener("DOMContentLoaded", init);
