/*
--- 
description: PiLazy
authors: 
- David Chan CK
license:
- MIT-style license
requires: 
- core/1.4.5: '*'
- more/1.4.0.1: [Utilities.Assets]
provides: [PiLazy]
...
*/
var PiLazy = new Class ({
	Implements: [Events, Options],
	options: {
		/*
		onLoad: $empty(event),
		onProcessStart: $empty(element, event),
		onProcessEnd: $empty(element, instance, event),
		onInstanceExists: $empty(element, instance, event),
		*/
		watched: null,                       // Watched parent container; if set, uses relay, else, will get elements by classname attribute.
		eventsCaptured: 'click',             // Events monitored on elements to lazy load; defaults to click, also accepts an array for multiple event handles.
		dataAttributes: {                    // These are html attributes set on the element for lazy loading configuration.
			script: 'data-script',             // File path to download; required.
			klass: 'data-klass',               // JS Class to instantiate; if set, uses it as class name, else, will assume filename as class name.
			eventsCaptured: 'data-events',     // Overrides default eventsCaptured; If options.watched is set, this option will be ignored.
			arguments: 'data-arguments',       // Arguments to pass to constructor; optional. 
			decorated: 'data-decorated',       // Decorated parent element for loading and active state; if set, css classes will be added to this element instead, else, will use self.
			isExternal: 'data-is-ext',         // Loads external script; requires server component. See README.md for more detail.
			hasMultiple: 'data-has-multi'      // Elements can instantiate more than once by event; defaults to false.
		}
	}
});

// Static vars and functions
PiLazy.extend({
	instances: [],
	addInstance: function(instance) {
		PiLazy.instances.push(instance);
		return PiLazy.instances.length-1;
	},
	getInstanceByKey: function(referenceIndex) {
		if (PiLazy.instances && PiLazy.instances[referenceIndex]) {
			return PiLazy.instances[referenceIndex];
		}
		return null;
	},
	getInstance: function(_element) {
		if (_element && _element.retrieve) {
			var key = _element.retrieve('piLazyKey');
			return PiLazy.getInstanceByKey(key);
		}
		return null;
	}
});

PiLazy.implement({
	initialize: function(elements, options) {
		this.setOptions(options);
		var opts = this.options;
		
		if (opts.watched) {
			this._watched = document.id(opts.watched);
		}
		else {
			this._elements = document.body.getElements(elements);
			this._elements.each(function(_element) {
				_element.addEvent(opts.eventsCaptured, this.handleEvent.bind(this, _element));
			}.bind(this));
		}
	},
	handleEvent: function(_element, e) {
		if (e)
			e.preventDefault();
		this.fireEvent('lazyClick', _element);
		this.load(_element);
	},
	instantiate: function()
	{
		var Klass = this.Klass;
		Klass = new Class({
			Extends: Klass,
			initialize: function() {
				this.parent.apply(this, arguments[0]);
			}
		});
		return new Klass(arguments);
	},
	load: function(_element) {
		var dataOpts = this.options.dataAttributes;
		this.klass_name = _element.getAttribute(dataOpts.klass).trim();
		this.Klass = this.klass_finder(this.klass_name);
		if (this.Klass) { // console.log('Class is already loaded');
			this.loaded(_element);
			return;
		}
		else { // console.log('Class is not loaded');
			var script = _element.getAttribute(dataOpts.script).trim();
			var decorated = _element.getAttribute(dataOpts.decorated) || '';
			var _decorated = _element.getParent(decorated.trim());
			_decorated.addClass('loading');
			new Asset.javascript(script, {
				'onload': this.loaded.bind(this, _element)
			});
		}
	},
	klass_finder: function(string) {	  
		var klass_parts = string.split('.');
		var child = '';
		var klass = null;
		klass_parts.some(function(part, i) {
			var parent = null;
			if (i == 0) {
				parent = window;
				child = part;
			}
			else {
				parent = klass;
				child = part;
			}
			if (!parent) {
				klass = null;
				return true;
			}
			klass = parent[child];
			return false;
		});
		return klass;
	},
	loaded: function(_element) {
		this.fireEvent('load');
		this.process(_element);
	},
	string_to_array: function(str) {
		var array = [];
		var constructed = [];
		if (str) {
			array = str.split('|');
			array.each(function(piece) {
				constructed.push(eval(piece));
			});
		}
		return constructed;
	},
	process: function(_element) {
		this.fireEvent('processStart', _element);
		if (!this.Klass) {
			this.Klass = this.klass_finder(this.klass_name);
		}
		var dataOpts = this.options.dataAttributes;
		this.args = this.string_to_array(_element.getAttribute(dataOpts.arguments)) || [];

		if (!PiLazy.getInstance(_element)) {
			_element.store('piLazyKey',
				PiLazy.addInstance(
					this.instantiate.apply(this, this.args)
				)
			);
		}
		else {
			this.fireEvent('instanceExists', [_element, PiLazy.getInstance(_element)]);
		}
		this.fireEvent('processEnd', _element);
	}
});