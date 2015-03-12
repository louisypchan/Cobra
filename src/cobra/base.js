/****************************************************************************
 Copyright (c) 2014 Louis Y P Chen.

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:
 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.
 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/
/**
 * Created by Louis Y P Chen on 2015/1/4.
 */
cobra.add("cobra/base", ['lang', 'cobra/stateful', 'cobra/directive'], function(lang, stateful, directive){
    /**
     * Emit events
     * @param node
     * @param events
     */
    function emitEvent(node, events){
        events = events.split(";");
        var match;
        $.each(events, lang.ride(this, function(idx, e){
            match = e.match(cobra.base.eventRegex);
            if(match){
                if(!node.$cobraEvent) node.$cobraEvent = {};
                if(!node.$cobraEvent[match[1]]){
                    node.$cobraEvent[match[1]] = true;
                    (function(t, m, n){
                        n.on(m[1], lang.ride(this, function(evt){
                            $.isFunction(t[m[2]]) && t[m[2]].apply(t, m[3].split(",").concat([n]));
                            evt.stopImmediatePropagation();
                        }));
                    })(this, match, $(node));
                }
            }
        }));
    }
    /**
     * core base
     */
    return cobra._({
        "~name" : "cobra.base",
        "~superclass" : stateful,
        //old model directive
        "+nodePrefix" : "cb-node", //detect the elements' attribute along with cb-node, cb-node={name}
        "+eventPrefix" : "cb-event",
        "+tmplRegex" : /([^~]*)~?tmpl#([^#]+)/i, // tmpl key regex expression
        "+eventRegex" : /([^~]+)~([^:]+):?([^:]*)/, //event regex expression
        //check whether the cobra has been booted or not
        _booted : false,
        $ : {}, // to collect the instances from "cb-node", won't allow to be inherited
        Q : {}, // to collect those elements filtered through by selectors
        req : {}, //to collect the response data
        _attrHash : {}, // to cache attribute names and their getter and setter
        api : null,
        _msgBox : null, //the internal instance of toastr
        __topics : {}, //to store the topic
        templates : null,
        host : null,
        $app : null,
        $ENV : 'stub',
        /**
         * constructor
         *
         * arguments /Object/
         *
         * {
         *      selector : ['.a','.b','.c']
         * }
         *
         */
        ctor : function(args){
            this._super(args);
            this._options = args || false;
            if(!this._msgBox){
                this._msgBox = new cobra.msgBox();
            }
            //not allow to modify cb-node in runtime
            cobra.aspect.before($.fn, "attr", function(){
                var arity = arguments.length;
                if(arity == 2 && arguments[0] === cobra.base.nodePrefix && arguments[1]){
                    throw new Error("Attribute cb-node is not allowed to be modified in runtime!");
                }
            });
            var that = this, collect = function(){
                var node = this[0];
                // We can make a rule that
                // The aspect will only be executed
                // if the dynamic constructions happened by cb-node and directives defined
                // So we can use if(this.attr(cobra.base.nodePrefix) || node.$compiled)
                // to filter out many meaningless cases
                // I think we need to put the condition here
                // If there were some errors with specific function
                // Just change the function
                if(this.attr(cobra.base.nodePrefix) || node.$compiled){
                    that.$compile(node.firstChild, node.$scope || that.$getController(node));
                }
            };
            cobra.aspect.after($.fn, "append", collect);
            cobra.aspect.after($.fn, "html", collect);
            //cobra.aspect.after($.fn, "appendTo", collect);
            cobra.aspect.after($.fn, "prepend", collect);
            //cobra.aspect.after($.fn, "prependTo", collect);
            cobra.aspect.after($.fn, "after", function(){this.next().each(function(){that.$$compile(this, this.$scope || that.$getController(this));})});
            cobra.aspect.after($.fn, "before", function(){this.prev().each(function(){that.$$compile(this, this.$scope || that.$getController(this));})});
            //cobra.aspect.after($.fn, "wrap", collect);
            //cobra.aspect.after($.fn, "unwrap", collect);
            //cobra.aspect.after($.fn, "wrapAll", collect);
            //cobra.aspect.after($.fn, "wrapInner", collect);
            //cobra.aspect.after($.fn, "replaceWith", collect);
            cobra.aspect.before($.fn, "empty", function(){this.each(function(){that.$remove(this, false)})});
            cobra.aspect.before($.fn, "remove", function(){this.each(function(){that.$remove(this, true)})});
            //cobra.aspect.after($.fn, "detach", collect); won't support detach here
            this.bootStrap();
        },
        $getController : function(node){
            var parent = $(node).parent();
            while(parent.size() > 0 && !parent.hasClass(directive.tags.ypController)){
                parent =  parent.parent();
            }
            var c = parent.attr(directive.attrs.ypController);
            return c ? this["$" + c] : null;
        },
        /**
         * to boot the base class
         */
        bootStrap : function(){
            if(!this._booted){
                this._booted = true;
                var args = this.$$compile(cobra.doc.body, this);
                $.when.apply(this, args).done(lang.ride(this, function(){
                    this.postCreate();
                }));
            }
        },
        /**
         *
         * @param node
         * @param removeItself
         */
        $remove : function(node, removeItself){
            if(removeItself){
                var name = $(node).attr(cobra.base.nodePrefix);
                if(name){
                    //delete from the storage
                    if(this.$[name]){
                        delete this.$[name];
                    }
                }
                if(node.$$watcher){
                    var index = $.inArray(node.$$watcher, this.__$$__watchers__$$__);
                    if(index > -1){
                        try{
                            this.__$$__watchers__$$__.splice(index, 1);
                        }catch (e){}
                    }
                }
            }
            node = node.firstChild;
            while(node){
                this.$remove(node, true);
                node = node.nextSibling;
            }
        },

        _parseNode : function(node){
            if(node.nodeType != 1 || $.nodeName(node, "object")) return;
            var $node = $(node), _1 = $node.attr(cobra.base.nodePrefix), _2 = $node.attr(cobra.base.eventPrefix);
            if(_1){
                //update the storage
                this.$[_1] = $node;
            }
            if(_2){
                //emit the events
                emitEvent.apply(this, [node, _2]);
            }
        },
        /**
         *
         * @param node
         * @param scope
         * @returns {*}
         */
        $$compile : function(node, scope){
            //check the node itself to see if we can get something
            //for old directive like cb-node cb-event etc.
            this._parseNode(node);
            this.$compile(node.firstChild, scope);
        },
        /**
         *
         * @param node
         * @param scope
         */
        $compile : function(node, scope){
            scope = scope||this;
            var directives, $scope, i = 0;
            while(node){
                node.$index = i++;
                if(!node.$parsed){
                    //To cache the parse state
                    //in case multiple compile happened
                    node.$parsed = true;
                    this._parseNode(node);
                    directives = directive.collect.call(this, $(node));
                    $scope = this.applyDirectivesToNode(directives, node, scope);
                    this.$compile(node.firstChild, $scope);
                }
                node = node.nextSibling;
            }
        },
        /**
         *
         * @param directives
         * @param node
         * @param scope
         * @returns {*}
         */
        applyDirectivesToNode : function(directives, node, scope){

            $.each(directives, lang.ride(this, function(idx,it){
                switch (it.tag){
                    case directive.tags.ypController :
                        scope = $.isFunction(it.compile) && it.compile.apply(this, [node, it.attr, scope]);
                        break;
                    case directive.tags.ypModel :
                        if($.isFunction(it.compile)){
                            it.compile.apply(this, [node, it.attr, scope]);
                        }
                        break;
                    case directive.tags.ypTemplate :
                        $.isFunction(it.compile) && (it.compile.apply(this, [node, it.attr]));
                        break;
                    case directive.tags.ypVar :
                        $.isFunction(it.compile) && (scope = it.compile.apply(this, [node, it.attr, scope]));
                        break;
                }
            }));
            return scope;
        },
        /**
         * template parse
         *
         * @param html
         *      a string with expressions in the form `${key}` to be replaced
         * @param data
         *      data to search
         * @param transform
         *      a function to process all parameters before replacing
         * @param scope
         *      where to look for optional
         * @returns {string}
         *
         * example:
         *      parse("File '${0}' is not found in directory '${1}'.",["foo.html","/temp"]);
         *      parse("File '${name}' is not found in directory '${info.dir}'.", { name: "foo.html", info: { dir: "/temp" } });
         *      parse("${0} is not found in ${1}.", ["foo.html","/temp"], function(str){var prefix = (str.charAt(0) == "/") ? "directory": "file";return prefix + " '" + str + "'";});
         *      parse("${0:postfix}", ["thinger"], null, {postfix: function(value, key){return value + " -- howdy";});
         */
        parse : function(html, data, transform, scope){
            return lang.parse(html, data, transform, scope);
        },
        /**
         * A sync method to render a template
         * the engine based on doT
         * check doT: http://olado.github.io/doT/
         */
        doT : function(html, data){
            return lang.compile(html, data)(data);
        },
        /**
         *
         * @param key
         * @returns {string}
         */
        getQuery:function(key){
            var t = {};
            location.search.replace("?","").replace(/&?([^=&]+)=([^=&]*)/g, function($0, $1,$2){ t[$1] = $2; });
            return typeof t[key] === "undefined" ? "" : t[key];
        },
        /**
         *
         * @param topic
         * @param cb
         */
        subscibe : function(topic, cb){
            if(!this.__topics[topic]){
                this.__topics[topic] = $.Callbacks("once");
            }
            this.__topics[topic].add(cb);
        },
        /**
         *
         * @param topic
         * @param args
         */
        publish : function(topic, args){
            if(this.__topics[topic]){
                this.__topics[topic].fire(args);
            }
        },
        /**
         * Helper function for set and get
         * @param names
         */
        _helper : function(name){
            var ah = this._attrHash;
            if(ah[name]) return ah[name];
            var _name = name.charAt(0).toUpperCase() + name.substr(1);
            return (ah[name] = {
                setter : "_set" + _name,
                getter : "_get" + _name
            });
        },
        /**
         *
         * @param name
         * @returns {*}
         */
        get : function(name){
            return this._get(name, this._helper(name));
        },
        /**
         *
         */
        _get : function(name, helper){
            return $.isFunction(this[helper.getter]) ? this[helper.getter]() : this[name];
        },
        /**
         * set value or render template
         * @param name
         * @param value
         * @returns {jQuery.Deferred}
         */
        set : function(name, value){
            if($.type(name) === "object"){
                //if an object
                for(var n in name){
                    if(name.hasOwnProperty(n) && n !="_watchCallbacks"){
                        this.set(n, name[n]);
                    }
                }
            }
            //make sure name is a string
            name = name + "";
            var match = name.match(cobra.base.tmplRegex);
            if(match){
                //hit template
                return this.$render(match[2], value, match[1]);
            }else{
                //common set
                var helper = this._helper(name),
                    oldVal = this._get(name, helper),
                    setter = this[helper.setter],
                    result;
                if($.isFunction(setter)){
                    result = setter.apply(this, Array.prototype.slice.call(arguments, 1));
                }else{
                    //no setter
                    this[name] = value;
                }
                if(this._watchCallbacks){
                    // If setter returned a promise, wait for it to complete, otherwise call watches immediately
                    $.when(result).done(lang.ride(this, function(){
                        this._watchCallbacks(name, oldVal, value);
                    }));
                }
            }
        },
        __checkTemplate : function(templateId){
            if(!templateId) throw new Error("Invalid template id!");
            if(!this.templates) throw new Error("Can not find templates defined");
            if(!this.templates[templateId]) throw new Error('"' + templateId + '"' + " is not defined in templates");
        },
        /**
         * render the template
         * @param templateId
         * @param args  (String|Object)
         * @param refNode
         * @returns {jQuery.Deferred}
         */
        $render : function(templateId, args, refNode){
            this.__checkTemplate(templateId);
            var $def = new $.Deferred();
            refNode = refNode || templateId;
            if($.type(args) === "string"){
                args = this.request(args);
            }
            $.when(this.templates[templateId], args).done(lang.ride(this, function(html, data){
                this.$[refNode] && this.$[refNode].html(this.doT(html, data));
                $def.resolve(this);
            }));
            return $def;
        },
        /**
         * Watches a property for changes
         * @param name
         * @param cb
         */
        watch : function(name, cb){
            var callbacks = this._watchCallbacks;
            if(!callbacks){
                var self = this;
                callbacks = this._watchCallbacks = function(name, oldValue, value, ignoreCatchall){
                    var notify = function(propertyCallbacks){
                        if(propertyCallbacks){
                            propertyCallbacks = propertyCallbacks.slice();
                            for(var i = 0, l = propertyCallbacks.length; i < l; i++){
                                propertyCallbacks[i].call(self, name, oldValue, value);
                            }
                        }
                    };
                    notify(callbacks['_' + name]);
                    if(!ignoreCatchall){
                        notify(callbacks["*"]); // the catch-all
                    }
                }
            }
            if(!cb && $.isFunction(name)){
                cb = name;
                name = "*";
            }else{
                name = '_' + name;
            }
            if(!this._watchCallbacks[name]){
                this._watchCallbacks[name] = [];
            }
            this._watchCallbacks[name].push(cb);
        },
        /**
         * unwatch method
         * @param name
         */
        unwatch : function(name){
            if(this._watchCallbacks[name]){
                delete this._watchCallbacks[name];
            }
        },
        /**
         *
         * @param topic
         */
        unsubscibe : function(topic){
            if(this.__topics[topic]){
                this.__topics[topic].empty();
            }
        },
        //interface can be implemented by sub-classes
        onBeforeBootStrap : function(){
            //handle username here temporary
            if(!cobra.cookieSupported){
                this._msgBox.warn(" 该浏览器不支持cookie!");
            }
        },
        /**
         * compile the specific template along with the given data to the reference node
         * @param $node
         * @param templateId
         * @param data
         * @param action
         * @returns {jQuery.Deferred}
         */
        compile : function($node, templateId, data, action){
            this.__checkTemplate(templateId);
            action = action||"html";
            $node[action](this.doT(this.templates[templateId], data));
        },
        /**
         * get template by through the given template id
         * @param templateId
         */
        getTemplate : function(templateId){
            this.__checkTemplate(templateId);
            return this.templates[templateId];
        },
        /**
         *
         * @param name
         * @returns {jQuery.Deferred}
         */
        request : function(name){
            if(!this.api) { throw new Error("No API is defined!");}
            if(!name) { throw new Error("No API name is defined!");}
            var dtd = new $.Deferred(), $def = new $.Deferred();
            cobra.use(["schema/" + name], function(schema){
                dtd.resolve(schema);
            });
            var options = this._parseAPIName(name);
            options = $.extend({dataType:"json"}, options);
            options.type = options.type||"get";
            if(options.type.toLowerCase() === "get"){
                var deleteData = false;
                if(/\${[^}]+}/.test(options.url)){
                    deleteData = true;
                }
                var parsedURL = this.parse(options.url, options.data, null, null);
                options.url = parsedURL||options.url;
                deleteData  && (delete options.data);
            }
            //constructor url
            if(this.host && (options.url.indexOf("http://") == -1 && options.url.indexOf("https://") == -1)){
                options.url = this.host[this.$ENV] + options.url;
            }
            $.when(dtd, $.ajax(options)).done(lang.ride(this, function(schema, args){
                var data = args[0];
                var result = cobra.validate(data, schema, false);
                if(result.valid){
                    if(data.statusCode == 200 && data.responseBody.responseInfo.reasons.code == "0000"){
                        data = data.responseBody;
                        this.req[name] = data;
                        var msg;
                        $.isFunction(options.done) && (msg = options.done.apply(this, [data]));
                        this.$digest();
                        $def.resolve(msg||data);
                    }else{
                        if(data.statusCode == 200 && data.responseBody.responseInfo.reasons.code == "4000"){
                            location.href = "{{loginPage}}";
                            return;
                        }
                        if($.isFunction(options.fail)){
                            if(options.fail.apply(this, [data, result, data.responseBody]) === true){
                                var code = data.responseBody.responseInfo.reasons.code, msg = data.responseBody.responseInfo.reasons.msg;
                                this._msgBox.warn(msg + "(" + code + ")");
                            }
                        }
                        $def.reject([data, result, data.responseBody]);
                    }
                }else{
                    //overlay to show error page
                    //print here temporary
                    $def.reject();
                    //console.log(result);
                    this._msgBox.error("网络繁忙，请稍后重试!(CB001)");
                }
            })).fail(lang.ride(this, function(){
                $def.reject();
                $.isFunction(options.fail) && options.fail.call(this);
                this._msgBox.error("网络繁忙，请稍后重试!");
            }));
            return $def
        },
        /**
         *
         * @param name
         * @returns {*}
         * @private
         */
        _parseAPIName : function(name){
            var fn = this[name + "Args"];
            if(!$.isFunction(fn)){
                throw new Error("Can't find the respectively function to set up the request parameters for api!");
            }
            if(!this.api[name]) throw new Error("API " + name + " is not defined correctly");
            var options = {};
            options.url = this.host && this.$ENV === "stub" ? this.api[name].dev_url : this.api[name].url;
            return $.extend(options, fn.call(this));
        },
        /**
         * If in dirty checking mode, use this function to run dirty checking manually
         * @param fn
         */
        $apply : function(fn, args){
            if($.isFunction(fn)){
                $.when(fn.apply(this, args)).done(lang.ride(this,function(){
                    this.$digest();
                }));
            }
        }
    });
});