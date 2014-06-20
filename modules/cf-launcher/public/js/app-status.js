/*jslint browser:true*/
/*global $ console*/
var node = document.getElementById.bind(document);

function appxhr(method, url, body, doneCallback) {
	var xhr = new XMLHttpRequest();
	xhr.open(method, url);
	xhr.onreadystatechange = function() {
		if (xhr.readyState === 4) {
			doneCallback(xhr);
		}
	};
	xhr.setRequestHeader("Content-Type", "application/json");
	xhr.send(body || null);
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
	get: function(callback) {
		appxhr("GET", "apps/", null, this._invokeCb.bind(this, callback));
	},
	stop: function(callback) {
		this._changeState("stop", callback);
	},
	debug: function(breakOnStart, callback) {
		this._changeState((breakOnStart ? "debugbreak" : "debug"), callback);
	},
	_changeState: function(newState, callback) {
		var app = this.app;
		app.state = newState;
		appxhr("PUT", "apps/" + encodeURIComponent(app.name), JSON.stringify(app), this._invokeCb.bind(this, callback));
	},
	_invokeCb: function(callback, xhr) {
		var app = this.app = parseApp(xhr.responseText);
		if (!app) {
			callback(new Error(xhr.responseText));
			return;
		}
		this.app = app;
		callback();
	}
};

var view = {
	render: function(err) {
		var panel = node("app-status-panel");
		if (err) {
			panel.textContent = err.toString();
			return;
		}
		var app = control.app, isDebugging = (app.state === "debug" || app.state === "debugbreak"),
		    template = isDebugging ? node("template-debug") : node("template-stop"),
		    status = template.cloneNode(true);
		replaceSubtree(status, {
			name: app.name
		});
		panel.innerHTML = ""; // empty
		panel.appendChild(status);
		this.bind();
	},
	bind: function() {
		var btnStop = node("btn-stop"), btnStart = node("btn-start"), btnRestart = node("btn-restart");
		var btnBreak = node("btn-break"), btnNoBreak = node("btn-no-break");
		if (btnStop) {
			btnStop.onclick = function() {
				control.stop(view.render.bind(view));
			};
		}
		btnBreak.onclick = function() {
			control.breakOnStart = true;
		};
		btnNoBreak.onclick = function() {
			control.breakOnStart = false;
		};
		var start = function() {
			var dialog = $("#startPrompt").modal("show");
			dialog.on("hide.bs.modal", function() {
				log("starting app, --debug-brk: " + control.breakOnStart);
				control.debug(control.breakOnStart, view.render.bind(view));
			});
		};
		if (btnStart)
			btnStart.onclick = start;
		if (btnRestart)
			btnRestart.onclick = start;
	}
};

function init() {
	control.get(function(err, app) {
		view.render(err, app);
	});
}

document.addEventListener("DOMContentLoaded", init);
