/*  AmigaGuideJS created by RobSmithDev    https://robsmithdev.co.uk
    Source code is available multi-licensed under the terms of:
        The Mozilla Public License Version 2.0as published by Mozilla Corporation
		The GNU General Public License version 2 or later, as published by the Free Software Foundation
    The source code is publicly and freely available from https://github.com/RobSmithDev/amigaguidejs
	Please support this project by supporting https://retro.directory
*/

// Class to view
class AmigaGuideViewer {
	
	// Create instance of Amiga Guide Viewer
	constructor(fileUrl, targetDiv, kickstart_13_Style = false, forceWordwrap = false) {
		if (typeof targetDiv === 'string') targetDiv = document.getElementById(targetDiv);
		if (typeof targetDiv !== 'object') throw new Error('targetDiv is invalid');
		
		// Boot strap the container
		targetDiv.classList.add('amigaguide_container');
		
		window._AmigaGuideViewers = window._AmigaGuideViewers || [];
		
		// Heading bar
		this.filename = fileUrl.substring(fileUrl.lastIndexOf('/')+1);
		this.header = document.createElement('header');
		this.header.classList.add('amigaguide_titlebar');
		targetDiv.appendChild(this.header);		
		this.headerTitle = document.createElement('span');
		this.header.appendChild(this.headerTitle);		
		this.headerTitle.innerHTML = 'AmigaGuideJS: '+this.filename;
		this.outerContentBox = document.createElement('div');
		
		this.history = [];
		
		// Navigation bar
		targetDiv.appendChild(this.outerContentBox);		
		this.headingBar = document.createElement('nav');		
		this.contentButtonBox = {
			contents : document.createElement('button'), 
			index : document.createElement('button'), 
			help : document.createElement('button'),
			retrace : document.createElement('button'),
			browseBack : document.createElement('button'),
			browseForward : document.createElement('button')
		}
		// Initialise buttons
		this.contentButtonBox.contents.innerHTML = 'Contents'; this.contentButtonBox.contents.onclick = ()=>{this.displayNode(this.defaultNode);};
		this.contentButtonBox.index.innerHTML = 'Index'; this.contentButtonBox.index.onclick = ()=>{this.displayNode(this.docProperties.indexnode);};
		this.contentButtonBox.help.innerHTML = 'Help'; this.contentButtonBox.help.onclick = ()=>{this.displayNode(this.docProperties.helpnode);};
		this.contentButtonBox.retrace.innerHTML = 'Retrace'; this.contentButtonBox.retrace.onclick = ()=>{this.retraceClicked();};
		this.contentButtonBox.browseBack.innerHTML = 'Browse &lt;'; this.contentButtonBox.browseBack.onclick = ()=>{this.displayNode(this.currentNode.prevnode);};
		this.contentButtonBox.browseForward.innerHTML = 'Browse &gt;'; this.contentButtonBox.browseForward.onclick = ()=>{this.displayNode(this.currentNode.nextnode);};
		
		// Add them
		this.headingBar.appendChild(this.contentButtonBox.contents);
		this.headingBar.appendChild(this.contentButtonBox.index);
		this.headingBar.appendChild(this.contentButtonBox.help);
		this.headingBar.appendChild(this.contentButtonBox.retrace);
		this.headingBar.appendChild(this.contentButtonBox.browseBack);
		this.headingBar.appendChild(this.contentButtonBox.browseForward);
		this.headingBar.appendChild(document.createElement('br'));
		this.headingBar.appendChild(document.createElement('hr'));
		this.outerContentBox.appendChild(this.headingBar);		
		
		this.contentBox = document.createElement('div');		
		this.outerContentBox.appendChild(this.contentBox);		
		this.boxID = targetDiv.id;
		
		window._AmigaGuideViewers[this.boxID] = this;
		
		this.contentBox.innerHTML = 'Loading file '+this.filename+', Please Wait...';
		
		if (kickstart_13_Style) {
			targetDiv.classList.add('amigaguide_container_v13');
			this.header.classList.add('amigaguide_titlebar_v13');			
		} else {
			targetDiv.classList.add('amigaguide_container_v31');
			this.header.classList.add('amigaguide_titlebar_v31');						
		}
		
		if (forceWordwrap) this.contentBox.classList.add('amigaguide_wordwrap');
		
		this.defaultHelpNode = '__defaulthelpnode.js';
		
		// Default doc properties
		this.docProperties = {
			database: '',
			author: '',
			copyright: '',
			version: '',
			defaultFont: '',
			indexnode: '',
			helpnode: this.defaultHelpNode,
			defaultNode: 'main'
		};
		this.nodes = [];
		this.currentNode = {};
		
		// The things that are allowed to follow an @
		this.tokens = [ '\\@', '@database','@author','@(c)','@$VER','@master','@font','@index','@help','@wordwrap','@node','@dnode','@remark','@title','@toc','@prev','@next','@keywords','@{','@endnode' ];
		
		// Trigger download
		fetch(fileUrl, { method: 'GET', mode: 'no-cors', redirect: 'follow', referrerPolicy: 'no-referrer'}).then( (response) => {
			if (!response.ok) {
				throw new Error(`HTTP error reading AmigaGuide file: ${response.status}`);
			}
			return response.arrayBuffer();
		}).then((data) => {
			const decoder = new TextDecoder('iso-8859-1');  // Amiga-1251 isnt supported
			this.contentBox.innerHTML = 'Parsing file '+this.filename+', Please Wait...';
			this.parseFile(decoder.decode(data));
		}).catch((error) => {
			console.log('Error loading '+fileUrl.substring(fileUrl.lastIndexOf('/')+1)+', '+error);
			this.contentBox.innerHTML = 'Error loading '+fileUrl.substring(fileUrl.lastIndexOf('/')+1)+', '+error;
		});		
	}
	
	// Parse a line of text and return an array of parameters, stop when terminator is reached or end of line
	parseParams(inputString, terminator = null) {
		let remaining = '';

		let ret = { 'params': [], 'remaining': '' };
		let quotes = false;
		let param = '';
		let lastChar = '';
		for (let index=0; index<inputString.length; index++) {
			if ((inputString[index] === '"') && (lastChar != '\\')) {
				if (quotes || param.length) ret.params.push(param); 
				quotes = !quotes;
				param = '';
			} else if ((inputString[index] === terminator) && (!quotes)) {
				ret.remaining = inputString.substring(index+1);				
				break;
			} else if ((inputString[index] == ' ') && (!quotes)) {
				if (param.length) ret.params.push(param); 
				param = '';
			} else param += inputString[index];				
			lastChar = inputString[index];
		}			
		if (param.length) ret.params.push(param);			
		return ret;
	}
	
	// Extract font info from the supplied data
	extractFontInfo(fontInfo) {
		let font = this.parseParams(fontInfo);
		if (font.params>=2) {
			let name = font.params[0].toUpperCase();
			let i = name.indexOf('.');
			if (i>=0) name = name.substring(0,i);
			
			if (name == 'HELVETICA') name = 'helvetica'; else
			if (name == 'COURIER') name = 'courier'; else
			if (name == 'TIMES') name = 'times new roman'; else
						name = 'AmigaGuide-Topaz'; 
			return {'name': font.params[0], 'size':(parseInt(font.params[1])*2)+'pt' };
		}
		return {'name': 'AmigaGuide-Topaz', 'size': '16pt'};
	}		
	
	// Handles colours 
	getColor(color) {
		if (['text','shine','shadow','fill','filltext','back','highlight'].indexOf(color)) return color[0].toUpperCase()+color.substring(1);
		return 'Text';
	}
	
	// Encodes font data in a span class
	encodeColourInfo(bgColor, fgColor) {		
		let c1 = 'bg'+this.getColor(bgColor);
		let c2 = 'fg'+this.getColor(fgColor);		
		return 'class="'+c1+' '+c2+'"';
	}
	
	// Make text HTML safer
	fixEntities(text) {
		text = text.replace(/\\@/g,'@');
		// Filter text to proper HTML escapes
		return text.replace(/[&<>']/g, function(match) {
				const charMap = {
					'&': '&amp;',
					'<': '&lt;',
					'>': '&gt;',
					"'": '&apos;',
					'"': '&quot;',
					'\A4': '&euro;',				
					'\A9': '&copy;'
				};
			return charMap[match];
		});
	}
	
	// retrace button clicked
	retraceClicked() {
		// Remove the current page;
		this.history.pop();
		// Fetch the previous
		this.displayNode(this.history.pop());
	}
	
	// Enable/disable a button
	enableButton(element, enabled) {
		element.disabled = !enabled;
	}
	
	// Attempt to display a node
	displayNode(name) {				
		let node = this.findNode(name);
		if (node === null) return false;
		
		this.history.push(name);

		this.currentNode = node;
		let font = this.extractFontInfo(node.font);
		let fontText = 'font-family: '+font.name+'; font-size: '+font.size;
		// Todo, add font: font-family: AmigaGuide-Topaz; font-size: '+fontInfo.size
		let txt = node.content.replace(/<bUtToN style="tempButtonStyle" onclick/g,'<button style="'+fontText+'" onclick');
		this.contentBox.innerHTML = '<span style="'+fontText+'"><span '+this.encodeColourInfo('back','text')+'>' + txt + '</span></span>';
		
		this.headerTitle.innerHTML = 'AmigaGuideJS: '+this.fixEntities(this.currentNode.title);
		
		this.outerContentBox.scrollTop = 0;
		
		this.enableButton(this.contentButtonBox.contents, (this.docProperties.defaultNode.length) && (this.docProperties.defaultNode !== this.currentNode.id));
		this.enableButton(this.contentButtonBox.index, (this.findNode(this.docProperties.indexnode) !== null) && (this.docProperties.indexnode !== this.currentNode.id));
		this.enableButton(this.contentButtonBox.help, (this.findNode(this.docProperties.helpnode) !== null) && (this.docProperties.helpnode !== this.currentNode.id));
		this.enableButton(this.contentButtonBox.retrace, this.history.length > 1);
		this.enableButton(this.contentButtonBox.browseBack, (this.findNode(this.currentNode.prevnode) !== null) && (this.currentNode.prevnode !== this.currentNode.id));
		this.enableButton(this.contentButtonBox.browseForward, (this.findNode(this.currentNode.nextnode) !== null) && (this.currentNode.nextnode !== this.currentNode.id));
		
		return true;
	}
	
	// Returns an object containing the node requested, or null if not found
	findNode(nodeName) {
		nodeName = (nodeName+'').toLowerCase().trim();
		for (let node of this.nodes) 
			if (node.id == nodeName) 
				return node;
		return null;
	}
	
	// Taken from https://stackoverflow.com/questions/1500260/detect-urls-in-text-with-javascript
	linkify(text) {
		var urlRegex =/(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
		let obj = this;
		return text.replace(urlRegex, function(url) {
			return '<a href="'+url+'" target="_blank">'+obj.fixEntities(url)+'</a>';
		});
	}
			
	// Parse the file
	parseFile(text) {
		// Check file type
		if (text.substring(0,9).toLowerCase() != '@database') throw new Error('This file is not an AmigaGuide file.');				
		
		let lines = text.split('\n');
	
		let currentFgColor = '';
		let currentBgColor = '';
		let currentFont = '';
		const regexSearch = /(?<!\\)@\{/;
		let currentNode = null;
		let lastNodeName = '';
		let lastNode = null;
		
		// Not the best, but now split into nodes.  All of these lines will start with an @
		for (let line of lines) {
			// Node trumps everything
			if (line.substring(0,5).toLowerCase() == '@node') {
				let node = this.parseParams(line.substring(5).trim());
				if (node.params.length>=2) {
					let nodeId = node.params[0].toLowerCase().trim();
					if (lastNode !== null) {
						lastNode.nextnode = nodeId;
					}
					currentNode = {
						'id': nodeId,
						'title' : node.params[1],
						'content': '',
						'prevnode': lastNodeName,
						'nextnode':'',
						'keywords':[],
						'font':this.extractFontInfo(this.docProperties.defaultFont)
					};
					lastNode = currentNode;
					lastNodeName = nodeId;
					this.nodes.push(currentNode);
					currentFgColor = 'text';
					currentBgColor = 'back';
				}				
			} else
			if (line.substring(0,7).toLowerCase() != '@remark') {
				if (currentNode === null) {
					if (line.substring(0,9).toLowerCase() == '@database') {
						this.docProperties.database = line.substring(9).trim();
					}else
					if (line.substring(0,7).toLowerCase() == '@author') {
						this.docProperties.author = line.substring(7).trim();
					}else
					if (line.substring(0,4).toLowerCase() == '@(c)') {
						this.docProperties.author = line.substring(5).trim();
					}else
					if (line.substring(0,5).toLowerCase() == '@$ver') {
						this.docProperties.version = line.substring(5).trim();
					}else
					if (line.substring(0,9).toLowerCase() == '@wordwrap') {
						this.contentBox.classList.add('amigaguide_wordwrap');
					}else
					if (line.substring(0,6).toLowerCase() == '@index') {
						this.docProperties.indexnode = line.substring(6).trim();
					}else
					if (line.substring(0,5).toLowerCase() == '@help') {
						this.docProperties.help = line.substring(5).trim();
					}else
					if (line.substring(0,5).toLowerCase() == '@font') {
						this.docProperties.defaultFont = line.substring(5).trim();
					}
				} else {					
					if (line.substring(0,8).toLowerCase() == '@endnode') {
						// easy.
						currentNode = null;
					} else 
					if (line.substring(0,5).toLowerCase() == '@font') {
						currentNode.font = this.extractFontInfo(this.parseParams(line.substring(5).trim()));
					} else 
					if (line.substring(0,5).toLowerCase() == '@prev') {
						let tmp = this.parseParams(line.substring(5).trim());
						if (tmp.params.length) currentNode.prevnode = tmp.params[0];
					} else
					if (line.substring(0,5).toLowerCase() == '@next') {
						let tmp = this.parseParams(line.substring(5).trim());
						if (tmp.params.length) currentNode.nextnode = tmp.params[0];
					} else
					if (line.substring(0,9).toLowerCase() == '@keywords') {
						let tmp = this.parseParams(line.substring(9).trim());
						for (let words of tmp.param) {
							let wordarr=words.split(',');
							for (let word of wordarr) {
								let t = word.trim();
								if (t.length()) currentNode.keywords.push(t);
							}
						}
					} else
					if (line.substring(0,5).toLowerCase() == '@dnode') {
						// Not implemented
					} else {
						
						let match = regexSearch.exec(line);
						while (match) {
							currentNode.content += this.fixEntities(line.substring(0, match.index));
							
							let command = this.parseParams(line.substring(match.index+2), '}');
							if (command.params.length) {
								switch (command.params[0].toLowerCase()) {
									case 'b': currentNode.content += '<b>'; break;
									case 'ub': currentNode.content += '</b>'; break;
									case 'i': currentNode.content += '<i>'; break;
									case 'ui': currentNode.content += '</i>'; break;
									case 'u': currentNode.content += '<u>'; break;
									case 'uu': currentNode.content += '</u>'; break;
									case 'fg': if (command.params.length>1) {
												   currentFgColor = command.params[1];
												   currentNode.content += '</span><span '+this.encodeColourInfo(currentBgColor, currentFgColor)+'>';
											   } 
											   break;
									case 'bg': if (command.params.length>1) {
												   currentBgColor = command.params[1];
												   currentNode.content += '</span><span '+this.encodeColourInfo(currentBgColor, currentFgColor)+'>';
											   } 
											   break;
									default: 
											// This would have to be a label
											if (command.params.length>2) {
												if ((command.params[1].toLowerCase() === 'link') && (command.params[0].length) && (command.params[2].length)) {
													currentNode.content += '<bUtToN style="tempButtonStyle" onclick="return ___handleAmigaGuideClick(\''+encodeURIComponent(this.boxID)+'\',\''+encodeURIComponent(command.params[2])+'\')">'+this.fixEntities(command.params[0])+'</button>';
												}
											}
											break;
											
								}
							}
							line = command.remaining;
							match = regexSearch.exec(line);							
						}
						currentNode.content += this.fixEntities(line);
												
						// This can contain any of the following inline @ tags
						// @{<label> <command>}						
						currentNode.content += '<br>';
					}					
				}	
			}							
		}		
		
		// replace links
		for (let node of this.nodes) {
			node.content = this.linkify(node.content);
		}
		
		this.appendDefaultHelpNode();
		
		if (this.displayNode(this.defaultNode)) return true;
		if (this.nodes.length<1) return false;
		this.defaultNode = this.nodes[0].id;
		return this.displayNode(this.defaultNode);		
	}	
	
	// Append a default help node
	appendDefaultHelpNode() {
		let node = {
			'id': this.defaultHelpNode,
			'title' : 'About AmigaGuideJS',
			'content': '',
			'prevnode': this.nodes.length ? this.nodes[this.nodes.length-1].id : '',
			'nextnode':'',
			'keywords':[],
			'font':this.extractFontInfo(this.docProperties.defaultFont)
		};
		
		node.content += '<span class="amigaguide_wordwrap"><b>AmigaGuideJS</b> created by <a href="https://robsmithdev.co.uk" target="_blank">RobSmithDev</a><br><br>';
		node.content += 'I created this because I kept coming across <a href="https://en.wikipedia.org/wiki/AmigaGuide" target="_blank">AmigaGuide</a> files on the Internet and this would be a nice quick way to view them.<br><br>';
		node.content += '<b>Licence</b><br><br>';
		node.content += 'The source code is available multi-licensed under the terms of:<br>';
		node.content += 'The <a href="https://www.mozilla.org/en-US/MPL/2.0/" target="_blank">Mozilla Public License Version 2.0</a> as published by Mozilla Corporation<br>';
		node.content += 'The <a href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html" target="_blank">GNU General Public License version 2 or later</a>, as published by the Free Software Foundation<br>';
		node.content += 'The source code is publicly and freely available from <a href="https://github.com/RobSmithDev/amigaguidejs" target="_blank">https://github.com/RobSmithDev/amigaguidejs</a>';
		node.content += '<br><br>Support this project by supporting <a href="https://retro.directory" target="_blank">retro.directory</a>.<br><br><a href="https://retro.directory" style="padding: 1em" target="_blank"><img src="//retro.directory/images/b191x98.png" width="191" height="98" alt="Listed in the retro.directory, take a look"></a>';
		node.content += '</span>';
				
		this.nodes.push(node);		
	}
}

// External handler for link clicking
function ___handleAmigaGuideClick(boxId, nodeId) {
	let cls = window._AmigaGuideViewers[decodeURIComponent(boxId)];
	if (cls) {
		cls.displayNode(decodeURIComponent(nodeId));
		return true;
	}			
	return false;
}