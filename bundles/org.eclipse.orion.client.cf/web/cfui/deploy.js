/*eslint-env browser, amd*/

define(["orion/bootstrap", "orion/xhr", "orion/webui/littlelib", 'orion/Deferred', 'orion/cfui/cFClient', 'orion/PageUtil', 'orion/selection', 'orion/explorers/explorer',
	'orion/URITemplate', 'orion/PageLinks', 'orion/preferences'], 
		function(mBootstrap, xhr, lib, Deferred, CFClient, PageUtil, mSelection, mExplorer, URITemplate, PageLinks, Preferences) {

	mBootstrap.startup().then(
		function(core) {
			
			var pageParams = PageUtil.matchResourceParameters();
			var deployResource = decodeURIComponent(pageParams.resource);
			var deployResourceJSON = JSON.parse(deployResource);
			
			var serviceRegistry = core.serviceRegistry;
//			var preferences = core.preferences;
			var cFService = new CFClient.CFService(serviceRegistry);
			
			// initial message
			document.getElementById('title').appendChild(document.createTextNode("Choose Space To Deploy")); //$NON-NLS-1$//$NON-NLS-0$
			var progressPane = document.getElementById('progressPane'); //$NON-NLS-0$
			var msgLabel = document.getElementById('messageLabel'); //$NON-NLS-0$
			var msgNode;
			var orgsDropdownNode = document.getElementById('orgsSection');
			var spacesTree = document.getElementById('spacesTree'); //$NON-NLS-0$
			var okButton = document.getElementById('okbutton'); //$NON-NLS-0$
			var devSection = document.getElementById('devSection'); //$NON-NLS-0$
			var devCheckbox = document.getElementById('devCheckbox'); //$NON-NLS-0$
			var devPassword = document.getElementById('devPassword'); //$NON-NLS-0$
			var isValid = false;
			var explorer;
			
			function showMessage(message){
				msgNode = msgLabel.appendChild(document.createTextNode(message)); //$NON-NLS-0$
				progressPane.classList.add("running");
			}
			
			function hideMessage(){
				if(msgNode){
					msgLabel.removeChild(msgNode);
				}
				progressPane.classList.remove("running");
			}
			
			var selection;
			
			function setValid(valid){
				isValid = valid;
				if(valid){
					okButton.classList.remove("disabled");
				} else {
					okButton.classList.add("disabled");
				}
				okButton.disabled = !valid;
			}
			
			function selectionValid() {
				if(!selection){
					return false;
				}
				var selected = selection.getSelection();
				if(selected===null || selected.length===0){
					spacesTree.classList.add("invalid");
					return false;
				}
				spacesTree.classList.remove("invalid");
				return true;
			}
			
			function devSectionValid() {
				if (!devCheckbox.checked) {
					devPassword.setCustomValidity("");
					return true;
				}
				if (!devPassword.value.length) {
					devPassword.setCustomValidity("Set a password.");
					return false;
				}
				devPassword.setCustomValidity("");
				return true;
			}
			
			function validate() {
				var isValid = devSectionValid() && selectionValid();
				setValid(isValid);
				return isValid;
			}

			function renderDevSection() {
				devCheckbox.addEventListener("change", function() {
					var disabled = !(devCheckbox.checked);
					devPassword.disabled = disabled;
					validate();
				});
				devPassword.addEventListener("input", validate);
				devSection.classList.remove("hidden");
			}

			showMessage("Getting spaces...");
			validate();
			
			
			// register hacked pref service
			
			var temp = document.createElement('a');
			temp.href = "../prefs/user";
			var location = temp.href;
			
			function PreferencesProvider(location) {
				this.location = location;
			}

			PreferencesProvider.prototype = {
				get: function(name) {
					return xhr("GET", this.location + name, {
						headers: {
							"Orion-Version": "1"
						},
						timeout: 15000,
						log: false
					}).then(function(result) {
						return result.response ? JSON.parse(result.response) : null;
					});
				},
				put: function(name, data) {
					return xhr("PUT", this.location + name, {
						data: JSON.stringify(data),
						headers: {
							"Orion-Version": "1"
						},
						contentType: "application/json;charset=UTF-8",
						timeout: 15000
					}).then(function(result) {
						return result.response ? JSON.parse(result.response) : null;
					});
				},
				remove: function(name, key){
					return xhr("DELETE", this.location + name +"?key=" + key, {
						headers: {
							"Orion-Version": "1"
						},
						contentType: "application/json;charset=UTF-8",
						timeout: 15000
					}).then(function(result) {
						return result.response ? JSON.parse(result.response) : null;
					});
				}
			};
			
			var service = new PreferencesProvider(location);
			serviceRegistry.registerService("orion.core.preference.provider", service, {});
			
			// This is code to ensure the first visit to orion works
			// we read settings and wait for the plugin registry to fully startup before continuing
			var preferences = new Preferences.PreferencesService(serviceRegistry);
			
			// cancel button
			var closeFrame = function() {
				 window.parent.postMessage(JSON.stringify({pageService: "orion.page.delegatedUI", 
					 source: "org.eclipse.orion.client.cf.deploy.uritemplate", cancelled: true}), "*");
			};
			
			var doAction = function() {
				showMessage("Deploying...");
				setValid(false);
				var selected = selection.getSelection();
				if(selected===null || selected.length===0){
					closeFrame();
					return;
				}
				
				explorer.getNavHandler().setSelectionPolicy("readonlySelection");
				
				if (devCheckbox.checked) {
					selected.DebugPassword = devPassword.value;
				}
				
				cFService.pushApp(selected, null, decodeURIComponent(deployResourceJSON.ContentLocation + deployResourceJSON.AppPath)).then(
					function(result){
						var appName = result.App.name || result.App.entity.name;
						var host = (result.Route !== undefined ? (result.Route.host || result.Route.entity.host) : undefined);
						postMsg({
							CheckState: true,
							ToSave: {
								ConfigurationName: appName + " on " + result.Target.Space.Name + " / " + result.Target.Org.Name,
								Parameters: {
									Target: {
										Url: result.Target.Url,
										Org: result.Target.Org.Name,
										Space: result.Target.Space.Name
									},
									Name: appName,
									Timeout: (result.Timeout !== undefined) ? result.Timeout : undefined,
									Debug: true, // password?
								},
								Url: (result.Route !== undefined) ? "http://" + host + "." + result.Domain : undefined,
								UrlTitle: (result.Route !== undefined) ? appName : undefined,
								Type: "Cloud Foundry",
								ManageUrl: result.ManageUrl,
								Path: deployResourceJSON.AppPath
							}
						});
					}, function(error){
//								if (error.HttpCode === 404){
//									postError({
//										State: "NOT_DEPLOYED",
//										Message: error.Message
//									});
//								} else if (error.JsonData && error.JsonData.error_code) {
//									var err = error.JsonData;
//									if (err.error_code === "CF-InvalidAuthToken"){
//										error.Retry = {
//											parameters: [{id: "user", type: "text", name: "User:"}, {id: "password", type: "password", name: "Password:"}]
//										};
//									} else if (err.error_code === "CF-TargetNotSet"){
//										var cloudSettingsPageUrl = new URITemplate("{+OrionHome}/settings/settings.html#,category=Cloud").expand({OrionHome : PageLinks.getOrionHome()});
//										error.Message = "Set up your Cloud. Go to [Settings](" + cloudSettingsPageUrl + ")."; 
//									}
//									postError(error);
//								} else {
									postError(error);
//								}
				}); //cCFService.pushApp()
			};

			document.getElementById('okbutton').onclick = doAction;
			document.getElementById('deployForm').onsubmit = function() {
				validate();
				if (isValid)
					doAction();
				return false; // do not try to POST this form
			};
			document.getElementById('closeDialog').onclick = closeFrame;
			 
			// allow frame to be dragged by title bar
			var that=this;
			var iframe = window.frameElement;
		    setTimeout(function() {
				var titleBar = document.getElementById('titleBar');
				titleBar.addEventListener('mousedown', function(e) {
					that._dragging=true;
					if (titleBar.setCapture) {
						titleBar.setCapture();
					}
					that.start = {screenX: e.screenX,screenY: e.screenY};
				});
				titleBar.addEventListener('mousemove', function(e) {
					if (that._dragging) {
						var dx = e.screenX - that.start.screenX;
						var dy = e.screenY - that.start.screenY;
						that.start.screenX = e.screenX;
						that.start.screenY = e.screenY;
						var x = parseInt(iframe.style.left) + dx;
						var y = parseInt(iframe.style.top) + dy;
						iframe.style.left = x+"px";
						iframe.style.top = y+"px";
					}
				});
				titleBar.addEventListener('mouseup', function(e) {
					that._dragging=false;
					if (titleBar.releaseCapture) {
						titleBar.releaseCapture();
					}
				});
		    });

		    //
			var configAdmin = serviceRegistry.getService('orion.cm.configadmin'); //$NON-NLS-0$
			configAdmin.getConfiguration("app.settings").then(
				function(config) {
					 // get target and app, then do push and open application
					getTarget(cFService, config, preferences).then(
						function(target){
							cFService.getOrgs(target).then(
								function(result2){
									hideMessage();
									
									var div1 = document.createElement("div");
									div1.id = "orgsLabel";
									div1.className = "leftLabel";
									var label = document.createElement("label");
									label.appendChild(document.createTextNode("Organization:"));
									div1.appendChild(label);
									orgsDropdownNode.appendChild(div1);

									var div2 = document.createElement("div");
									div2.id = "orgsDropdown";
									div2.className = "rightField";
									var orgsDropdown = document.createElement("select");
									result2.Orgs.forEach(function(org){
										var option = document.createElement("option");
										option.appendChild(document.createTextNode(org.Name));
										option.org = org;
										orgsDropdown.appendChild(option);
									});
									
									orgsDropdown.onchange = function(event){
										var selectedOrg = event.target.value;
										loadTargets(selectedOrg);
									};
									
									div2.appendChild(orgsDropdown);
									orgsDropdownNode.classList.add("sectionTable");
									orgsDropdownNode.appendChild(div2);
																		
									var targets = {};
									result2.Orgs.forEach(function(org){
										targets[org.Name] = [];
										if (org.Spaces)
											org.Spaces.forEach(function(space){
												var newTarget = {};
												newTarget.Url = target.Url;
												if (target.ManageUrl)
													newTarget.ManageUrl = target.ManageUrl;
												newTarget.Org = org.Name;
												newTarget.Space = space.Name;
												targets[org.Name].push(newTarget);
											});
									});
									
									selection = new mSelection.Selection(serviceRegistry, "orion.Spaces.selection"); //$NON-NLS-0$
									selection.addEventListener("selectionChanged", validate);

									explorer = new mExplorer.Explorer(
										serviceRegistry,
										selection,
										new SpacesRenderer({checkbox: false, singleSelection: true, treeTableClass: "Spaces"}));
									
									function loadTargets(org){
										var model = new mExplorer.ExplorerFlatModel(null, null, targets[org]);
										model.getId = function(item){
											return item.Space + item.Org;
										};
										spacesTree.classList.add("sectionTable");
										explorer.createTree(spacesTree.id, model, {});										
										
										renderDevSection();
										validate();
									}
									
									loadTargets(orgsDropdown.value);
								}, function(error){
									postError(error);
								}
							);
						}, function(error){
							postError(error);
						}
					);
				}
			);
		}
	);
	
	// make sure target is set and it matches the url in settings
	function getTarget(cFService, config, preferences) {
		var deferred = new Deferred();
		
		preferences.getPreferences('/cm/configurations').then(
			function(settings){
				var cloud = settings.get("org.eclipse.orion.client.cf.settings");
				if (cloud && cloud.targetUrl){
					var target = {};
					target.Url = cloud.targetUrl;
					if (cloud.manageUrl)
						target.ManageUrl = cloud.manageUrl;
					if (cloud.org)
						target.Org = cloud.org;
					if (cloud.space)
						target.Space = cloud.space;
					deferred.resolve(target);
					return;
				} else {
					var error = {};
					var cloudSettingsPageUrl = new URITemplate("{+OrionHome}/settings/settings.html#,category=Cloud").expand({OrionHome : PageLinks.getOrionHome()});
					error.Message = "Set up your Cloud. Go to [Settings](" + cloudSettingsPageUrl + ")."; 
					error.Severity = "Warning";
					deferred.reject(error);
				}
			}, function(error){
				var cloudSettingsPageUrl = new URITemplate("{+OrionHome}/settings/settings.html#,category=Cloud").expand({OrionHome : PageLinks.getOrionHome()});
				error.Message = "Set up your Cloud. Go to [Settings](" + cloudSettingsPageUrl + ")."; 
				error.Severity = "Warning";
				deferred.reject(error);
			}
		);
		return deferred;
	}

	function postMsg(status) {
		window.parent.postMessage(JSON.stringify({pageService: "orion.page.delegatedUI", 
			 source: "org.eclipse.orion.client.cf.deploy.uritemplate", 
			 status: status}), "*");
	}
	
	function postError(error) {
		if (error.HttpCode === 404){
			error = {
				State: "NOT_DEPLOYED",
				Message: error.Message
			};
		} else if (error.JsonData && error.JsonData.error_code) {
			var err = error.JsonData;
			if (err.error_code === "CF-InvalidAuthToken"){
				error.Retry = {
					parameters: [{id: "user", type: "text", name: "User:"}, {id: "password", type: "password", name: "Password:"}]
				};
			} else if (err.error_code === "CF-TargetNotSet"){
				var cloudSettingsPageUrl = new URITemplate("{+OrionHome}/settings/settings.html#,category=Cloud").expand({OrionHome : PageLinks.getOrionHome()});
				error.Message = "Set up your Cloud. Go to [Settings](" + cloudSettingsPageUrl + ")."; 
			}
		}
		
		window.parent.postMessage(JSON.stringify({pageService: "orion.page.delegatedUI", 
			 source: "org.eclipse.orion.client.cf.deploy.uritemplate", 
			 status: error}), "*");
	}
	
	function SpacesRenderer (options) {
		this._init(options);
	}
	SpacesRenderer.prototype = new mExplorer.SelectionRenderer(); 
	SpacesRenderer.prototype.constructor = SpacesRenderer;
	SpacesRenderer.prototype.getLabelColumnIndex = function() {
		return 0;
	};
	SpacesRenderer.prototype.emptyCallback = function(bodyElement){
		var tr = document.createElement("tr"); //$NON-NLS-0$
		var td = document.createElement("td"); //$NON-NLS-0$
		var noWorkspaceItems = document.createElement("div"); //$NON-NLS-0$
		noWorkspaceItems.classList.add("noFile"); //$NON-NLS-0$
		noWorkspaceItems.textContent = "No spaces found in this organization.";
		td.appendChild(noWorkspaceItems);
		tr.appendChild(td);
		bodyElement.appendChild(tr);
	}
	SpacesRenderer.prototype.getCellElement = function(col_no, item, tableRow){
		if(col_no===0){
			var col = document.createElement("td"); //$NON-NLS-0$
			var span = document.createElement("span"); //$NON-NLS-0$
			span.id = tableRow.id+"navSpan"; //$NON-NLS-0$
			col.appendChild(span);
			span.className = "mainNavColumn singleNavColumn"; //$NON-NLS-0$
			span.appendChild(document.createTextNode(item.Space + " (" + item.Org + ")"));
			return col;
		}
	};

});