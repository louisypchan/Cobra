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
 * Created by Louis Y P Chen on 2014/12/22.
 * This library is a mini version of BoLin
 * To check BoLin, we can check here: https://github.com/louisypchan/BoLin/tree/0.1rc1
 */

//A mini Cobra JavaScript Library based on jQuery
(function($, win){
    //  we won't use strict mode here
    var isAMD = typeof define != "undefined" && define.amd,
        doc = win.document, __synthesizes = [],
        op = Object.prototype,
        noop = function(){},
    // get IE version
    IE = (function(){
        var v = 3,
            div = doc.createElement("div"),
            a = div.all||[];
        do{
            div.innerHTML = "<!--[if gt IE " + ( ++v ) + "]><br><![endif]-->";
        }while(a[0]);

        return v > 4 ? v : !v;
    })();
    win.cobra = {};
    cobra.version = "0.1rc1";
    //locale
    cobra.locale = "zh-cn";
    //directive prefix
    //won't use this directive in phase one
    //TODO:
    cobra.attrPrefixes = ['cb-', 'cb:', 'ng-', 'ng:'];
    //internal functions
    //check the given property is in the object or not
    function isNotObjectProperty(obj, name){
        return (obj !== op[name] || !(name in op));
    }
    //to check if is a method of the object
    function objectHasMethod(object, method){
        return object != null && object[method] !== undefined && $.isFunction(object[method]);
    }
    /**
     * get the coresponding object from context
     * @param parts
     * @param create  if true - the given parts are not exists, then create them, otherwise not
     * @param context the context
     */
    function getProp(parts, create, context){
        var p, i = 0, rs = context;
        if(!rs){
            if(!parts.length){
                return window;
            }else{
                p = parts[i++];
                rs = window[p] || (create ? window[p] = {} : undefined);
            }
        }
        while(rs && (p = parts[i++])){
            rs = (p in rs ? rs[p] : (create ? rs[p] = {} : undefined));
        }
        return rs;
    }
    /**
     * set the value to the object formed by the given name
     * @param name
     * @param value
     * @param context
     */
    function setObject(name, value, context){
        var parts = name.split("."), p = parts.pop(), obj = getProp(parts, true, context);
        return obj && p ? (obj[p] = value) : undefined;
    }
    function getOBJ(name, create, context){
        return getProp(name ? name.split(".") : [], create, context);
    }
    /**
     * Allows for easy use of object member functions in callbacks and other places
     * in which the "this" keyword
     * @param scope
     * @param method
     */
    function ride (scope, method){
        if(arguments.length > 2){
            return rideArgs.apply(this, arguments);
        }
        if(!method){
            method = scope;
            scope = null;
        }
        if($.type(method) === "string"){
            scope = scope || window;
            if(!scope[method]){
                throw new Error('bl.__lang.ride: scope["', method, '"] is null (scope="', scope, '")');
            }
            return function() { return scope[method].apply(scope, arguments || []);};
        }
        return !scope ? method : function() { return method.apply(scope, arguments || []); };
    }
    function rideArgs (scope, method){
        var pre = Array.prototype.slice.call(arguments, 2);
        var named = $.type(method) === "string";
        return function(){
            var args = Array.prototype.slice.call(arguments);
            var f = named ? (scope||win)[method] : method;
            return f && f.apply(scope || this, pre.concat(args)); // mixed
        };
    }
    //+++++++++++++++++++++++++A mini observe engine begin +++++++++++++++++++++++++++


    //+++++++++++++++++++++++++AOP implementation begin +++++++++++++++++++++++++++
    cobra.aspect = (function(){
        /**
         * joinpoint — a point in the control flow.
         *      Examples:
         *          calling a method,
         *          executing a method’s body or an exception handler,
         *          referencing an object’s attribute, and so on.
         *
         * pointcut — a query that is used to define a set of affected joinpoints. Essentially this is a logical expression that can pick out joinpoints and make sure that their context is right.
         *      Examples: it can verify that the affected object is of right type, that we are in particular control flow branch, and so on.
         *
         * advice — an additional behavior (a code) that will be applied at joinpoints.
         *      Available advice types:
         *          "before"            — runs before a joinpoint,
         *          "after"             — runs after a joinpoint was executed,
         *          "after returning"   — runs only after a normal execution of a joinpoint,
         *          "after throwing"    — runs only if during execution of a joinpoint an unhandled exception was thrown.
         *          "around"            — runs instead of a joinpoint, may call the original joinpoint.
         *
         * aspect — an entity that encapsulates related pointcuts, and advices together, and can add some attributes to advised classes.
         * refer to http://www.lazutkin.com/blog/2008/05/17/aop-aspect-javascript-dojo/
         */
        "use strict";
        function advise(inst, method){
            this.next_before = this.prev_before =
                this.next_after = this.prev_after = this.next_around = this.prev_around = this;
            this.inst = inst;
            this.method = method;
            this.target = inst[method];
        }

        function __around(f, a){
            return f(a);
        }

        advise.prototype = {
            add : function(before, after, around, target){
                var advice = new advise(this.inst, this.method);
                advice.advise = this;
                advice.before = before;
                advice.after = after;
                advice.around = around;
                advice.target = this.target||target;

                this._add("before", advice);
                this._add("around", advice);
                this._add("after", advice);

                if(around){
                    advice.target = __around(around, advice.prev_around.target);
                }
                return advice;
            },

            _add : function(type, advice){
                if(advice[type]){
                    var next = "next_" + type, prev = "prev_" + type;
                    //create chain
                    (advice[prev] = this[prev])[next] = (advice[next] = this)[prev] = advice;
                }
            },

            remove : function(advice){
                this._remove("before", advice);
                this._remove("around", advice);
                this._remove("after" , advice);
            },

            _remove : function(type, advice){
                var next = "next_" + type, prev = "prev_" + type;
                advice[next][prev] = advice[prev];
                advice[prev][next] = advice[next];
            },

            destory : function(){
                var target = this.prev_around.target, advise = this.advise, na = this.next_around;
                this.remove(this);
                if(na !== this){
                    for(; na !== advise; target = na.target, na = na.next_around){
                        if(advise.around){
                            advise.target = __around(advise.around, target);
                        }
                    }
                }
                this.inst = 0;
            }
        };
        //TODO: to be mixin the result and arguments
        function AOPmaker(advised){
            var f =  function(){
                var process, rs;
                //running before chain
                for(process = advised.prev_before; process !== advised; process = process.prev_before){
                    process.before.apply(this, arguments);
                }
                //running the around chain
                try{
                    if(advised.prev_around == advised){
                        rs = advised.prev_around.target.apply(this, arguments);
                    }
                }catch (e){ throw e; }
                //running the after chain
                for(process = advised.prev_after; process !== advised; process = process.prev_after){
                    process.after.apply(this, arguments);
                }
                return rs;
            };
            f.advised = advised;
            return f;
        }

        function weaver(inst, method, advice){
            var f = inst[method], advised;
            if(f && f.advised){
                advised = f.advised;
            }else{
                advised = new advise(inst, method);
                //construct the advice chians by target
                advised.add(0, 0, 0, f);
                inst[method] = AOPmaker(advised);
                //inst[method].advised = advised;
            }
            return advised.add(advice.before, advice.after, advice.around, 0);
        }
        return {
            before : function(inst, method, advice) { return weaver(inst, method, {before : advice})},
            around : function(inst, method, advice) { return weaver(inst, method, {around : advice})},
            after  : function(inst, method, advice) { return weaver(inst, method, {after : advice})}
        };
    })();
    //+++++++++++++++++++++++++AOP implementation end+++++++++++++++++++++++++++
    cobra.observe = (function(){
        var observedprops = {}, PROPERTY_CHANGED = "handlePropertyChange";
        //to check whether is an obeserved property
        function isPropertyObserved(prop){
            return observedprops[prop] !== undefined;
        }
        //add the property into observation pool
        function addPropertyObserver(context, prop, methodName){
            var obj = observedprops[prop];
            if(isPropertyObserved(prop)){
                if(obj.targets.indexOf(context) > -1){
                    return;
                }
            }else{
                obj = observedprops[prop] = {
                    targets : [],
                    methodNames : []
                };
                methodName = methodName||PROPERTY_CHANGED;
                if(objectHasMethod(context, methodName)){
                    obj.targets.push(context);
                    obj.methodNames.push(methodName);
                }
            }
        }
        function removePropertyObserver(context, prop){
            if(!isPropertyObserved(prop)) return false;
            var obj = observedprops[prop],
                index = $.inArray(context, obj.targets);//obj.targets.indexOf(context); //use jQuery to instead of extension
            if(index){
                obj.targets.splice(index, 1);
                obj.methodNames.splice(index, 1);
                obj.targets.length == 0 && delete observedprops[prop];
            }
            return index;
        }

        function notifyPropertyChange(prop, context){
            if(isPropertyObserved(prop)){
                var obj = observedprops[prop],
                    c = obj.targets.slice(),
                    m = obj.methodNames.slice();
                for(var i = 0, l = c.length; i < l; i++){
                    //syn up the real property's value
                    c[i]["_"+prop] = c[i][prop];
                    if(context && c[i] === context){
                        context[m[i]].call(context, context[prop]);
                        break;
                    }
                    c[i][m[i]].call(c[i], context[prop]);
                }
            }
        }
        //populate the APIs
        return {
            add : addPropertyObserver,
            remove : removePropertyObserver,
            notify : notifyPropertyChange
        };
    })();
    //+++++++++++++++++++++++++A mini observe engine end +++++++++++++++++++++++++++
    //+++++++++++++++++++++++++OO implementation begin+++++++++++++++++++++++++++
    //+++++++++++++++++++++++++OO implementation begin+++++++++++++++++++++++++++
    cobra._ = (function(){
        /**
         * http://www.python.org/download/releases/2.3/mro/
         * class A(O)
         * class B(O)
         * class C(O)
         *
         * class E(A,B)
         *
         * mro(A) = [A,O]
         * mro(B) = [B,O]
         * mro(E) = [E] + merge(mro(A), mro(B), [A,B])
         * [E] + ([A,O], [B,O], [A,B])
         * [E,A]
         * [A,B]
         */
        function MRO(it){
            var t = it._meta._super, seqs = [it];
            if(t){
                if(!$.isArray(t)){
                    return seqs.concat(t);
                }else{
                    while(true){
                        seqs = seqs.concat(t);
                        t = t._meta._super;
                        if(!t){
                            break;
                        }
                    }
                    return seqs;
                }
            }
            return seqs;
        }
        /**
         * C3 Method Resolution Order (see http://www.python.org/download/releases/2.3/mro/)
         */
        function mro_c3(bases){
            var l = bases.length;
            if(l == 1){
                if(!bases[0]._meta._super){
                    return bases;
                }else{
                    return bases.concat(mro_c3([].concat(bases[0]._meta._super)));
                }
            }else{
                var seqs = [], res = [];
                for(var i = 0; i < l; i++){
                    seqs.push(MRO(bases[i]));
                }
                seqs.push(bases);
                while(seqs.length){
                    res = res.concat(merge(seqs));
                }
                return res;
            }
        }
        /**
         * Merge Impl
         */
        function merge(args){
            if(args){
                var t, l = args.length, top = 0, index, res = [];
                for(var i = 0; i < l; i++){
                    t = args[i][0];
                    top = 0;
                    index = -1;
                    //
                    for(var j = i+1; j < l; j++){
                        index = args[j].indexOf(t);
                        top += index;
                        //find in the first
                        if(index == 0){
                            args[j].splice(index,1);
                            if(args[j].length == 0){
                                args.splice(j, 1);
                            }
                            //break;
                        }
                        //still can find it, but not in the first
                        //
                        if(index > -1){
                            top += index;
                        }
                    }
                    //
                    if(top == 0 || top == -1){
                        res.push(t);
                        args[i].splice(0,1);
                        if(args[i].length == 0){
                            args.splice(i,1);
                        }
                        break;
                    }
                }
                if(!res.length){
                    throw new Error("can't build consistent linearization");
                }
                return res;
            }
        }
        /**
         * call parents' method implementation
         * [fix the OOM issue]
         */
        function callSuperImpl(){
            var caller = callSuperImpl.caller, name = caller._name,
                meta = this._class._meta, p, _super, f;
            while(meta){
                _super = meta._super;
                p = _super.prototype;
                // fix the OOM issue
                // to find out the inheritance relation ships
                if(p && p[name] && ($.isFunction(p[name]) && (meta.ctor === caller||meta.transparent[name] === caller))){
                    f = p[name];
                    break;
                }
                // go loop
                meta = _super._meta;
            }
            if(f){
                f.apply(this, arguments);
            }
        }

        var isStatic = function(it){
                return it.indexOf("+") == 0;
            },
            isNelectful  = function(it){
                return it.indexOf("~") == 0;
            },
            safeMixin = function(target, source, crackPrivate){
                var name, t, p = [];
                for(name in source){
                    t = source[name];
                    if(isNotObjectProperty(t, name) && !isNelectful(name)){
                        if($.isFunction(t)){
                            //assign the name to a function
                            t._name = name;
                        }
                        target[name] = t;
                    }
                }
                return p;
            },
            aF = new Function,

            crackStatic = function(it){
                var t = it.prototype, name, src;
                for(name in t){
                    if(isStatic(name)){
                        src = t[name];
                        name = name.substr(1);
                        it[name] = src;
                        delete t["+" + name];
                    }
                }
                t = name = src = null;
            },
            //Create a constructor using a compact notation for inheritance and prototype extension.
            declare = function(obj){
                var superclass = obj["~superclass"], proto = {}, clsName = obj["~name"], ctor = false, crackPrivate = false, privates = [];
                if(superclass){
                    (function(supercls){
                        if($.isFunction(supercls)){
                            //force new
                            aF.prototype = supercls.prototype;
                            proto = new aF;
                            //clean up
                            aF.prototype = null;
                        }else if($.isArray(supercls)){
                            var t = supercls.slice(0);
                            t = mro_c3(t);
                            for(var i = 0, base, l = t.length; i < l; i++){
                                base = t[i];
                                aF.prototype = base.prototype;
                                privates = privates.concat(safeMixin(proto, new aF, false));
                                aF.prototype = null;
                            }
                        }
                        crackPrivate = true;
                    })(superclass);
                }
                //clone the properties
                var rPorot = $.extend(true, {}, proto);
                //add all properties
                privates = privates.concat(safeMixin(rPorot, obj, crackPrivate));
                //new constructor
                if(obj.ctor){
                    ctor =  rPorot.ctor = obj.ctor;
                }
                var f = (function(ctor){
                    return function(){
                        f.executed || processSynthesize(this);
                        if(ctor){
                            ctor.apply(this,arguments);
                        }
                        return this;
                    }
                })(ctor);
                f.executed = false;
                //cache meta information
                f._meta = {ctor : obj.ctor, synthesize : obj["~synthesize"], _super : superclass, transparent : rPorot};
                rPorot._super = callSuperImpl;
                //add inheritance cache brust
                rPorot.__icb__ = {};
                //constructor the prototype
                f.prototype = rPorot;
                f.privates = privates;
                //crack static
                crackStatic(f);
                //
                rPorot._class = f;
                //synthesize properties
                __synthesizes.push(f);
                //add name if specified
                if(clsName){
                    setObject(clsName, f);
                    rPorot._class._name = clsName;
                }
                //return
                return f;
            },
            processSynthesize = function(context){
                for(var it, i = 0, l = __synthesizes.length; i < l; i++){
                    it = __synthesizes[i];
                    it.executed || injectSynthesize(it, context);
                }
                __synthesizes.length = 0;
            },
            injectSynthesize = function (it, context){
                for(var i = 0 , synthesize = it._meta.synthesize, l = synthesize ? synthesize.length : 0; i < l; i++){
                    synthesizeProperty(it.prototype, synthesize[i], context);
                }
                it.executed = true;
            },
            synthesizeProperty = function (proto, prop, context){
                var m = prop.charAt(0).toUpperCase() + prop.substr(1),
                //getter
                    mGet = "get" + m,
                //setter
                    mSet = "set" + m,
                //real variable in use
                    _prop = "_" + prop;
                objectHasMethod(proto, mSet) || (proto[mSet] = function(value){
                    this[_prop] = value;
                });
                //define setter
                var setter = function(value){
                    this[mSet](value);
                };
                objectHasMethod(proto, mGet) || (proto[mGet] = function(){
                    return this[_prop];
                });
                //define getter
                var getter = function(){
                    return this[mGet]();
                };
                //to support IE7/IE8
                if(IE && IE < 9){
                    /**
                     // IE8 not all JavaScript Objects can use Object.defineProperty. This is so werid
                     // We have to chose another solution to support IE7 and IE8
                     // Here we consider that to use watch solution to simulate setter method
                     // That means when there is an asignment there will notify the specific method to be executed
                     // And consider that if we don't change to use function to minitor watching callbacks
                     // Here we go
                     */
                    cobra.observe.add(context, prop, mSet);
                }else{
                    Object.defineProperty(proto, prop, {
                        get: getter,
                        set: setter
                    });
                }
            };
        return declare;
    })();
    //+++++++++++++++++++++++++OO implementation end+++++++++++++++++++++++++++

    //+++++++++++++++++++++++++A Base class pre-defined begin+++++++++++++++++++++++++++
    cobra._({

        "~name" : "cobra.base",

        //model directive
        "+nodePrefix" : "cb-node", //detect the elements' attribute along with cb-node, cb-node={name}
        //check whether the cobra has been booted or not
        _booted : false,

        $ : {}, // to collect the instances from "cb-node", won't allow to be inherited

        Q : {}, // to collect those elements filtered through by selectors

        _attrHash : {}, // to cache attribute names and their getter and setter

        propertyCallbacks : [],
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
        ctor : function(){
            cobra.aspect.before(this, "_bootstrap", this.onBeforeBootStrap);
            cobra.aspect.after(this, "_bootstrap", this.onPostBootStrap);
            //some methods related to the changes of DOM operation
            var self = this,
            notify = function(){
                self.notify.call(self, arguments, this);
            };

            cobra.aspect.after($.fn, "append",notify);
            //don't allow to use attr to add/remove cb-node currently
            //TODO: add support
            //cobra.aspect.after($.fn, "attr", notify);
            cobra.aspect.before($.fn, "attr", function(){
                var arity = arguments.length;
                if(arity == 2 && arguments[0] === cobra.base.nodePrefix && arguments[1]){
                    throw new Error("Attribute cb-node is not allowed to be modified in runtime!");
                }
            });
            cobra.aspect.after($.fn, "html", notify);
            cobra.aspect.after($.fn, "appendTo", notify);
            cobra.aspect.after($.fn, "prepend", notify);
            cobra.aspect.after($.fn, "prependTo", notify);
            cobra.aspect.after($.fn, "after", notify);
            cobra.aspect.after($.fn, "before", notify);
            cobra.aspect.after($.fn, "insertAfter", notify);
            cobra.aspect.after($.fn, "insertBefore", notify);
            cobra.aspect.after($.fn, "wrap", notify);
            cobra.aspect.after($.fn, "unwrap", notify);
            cobra.aspect.after($.fn, "wrapAll", notify);
            cobra.aspect.after($.fn, "wrapInner", notify);
            cobra.aspect.after($.fn, "replaceWith", notify);
            cobra.aspect.after($.fn, "empty", notify);
            cobra.aspect.after($.fn, "remove", notify);
            cobra.aspect.after($.fn, "detach", notify);
            this._bootstrap(arguments);
        },

        _bootstrap : function(){
            if(!this._booted){
                $('[' + cobra.base.nodePrefix + ']').each(ride(this, function(index, elem){
                    var $elem = $(elem);
                    var attr = $elem.attr(cobra.base.nodePrefix);
                    this._helper$(attr, elem);
                    //clear it
                    $elem = attr = null;
                }));
                if(arguments){
                    var options = arguments[0][0];
                    if(options.selector){
                        $.each(options.selector, ride(this,function(index, s){
                            this.notifyQ(s);
                        }));
                    }
                }
                this._booted = true;
            }
        },

        _helper$ : function(name, value){
            var _name = "_" + name;
            if(this._watchCallbacks && !this._watchCallbacks["_" + _name]){
                this.watch(_name, this.update);
            }
            this.set(_name, value[0]||value);
            this.$[name] = $(value);
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
         * We have to notify the Q changes manually in case some changes are dynamic
         * eg: this.notifyQ(".a");
         * @param selector
         */
        notifyQ : function(selector){
            //remove . if is a class selector
            //remove # if is a id selector
            this.Q[selector.replace(/[\.#]/g,"")] = $(selector);
        },

        "set" : function(name, value){
            if($.type(name) === "object"){
                //if an object
                for(var n in name){
                    if(name.hasOwnProperty(n) && n !="_watchCallbacks"){
                        this.set(n, name[n]);
                    }
                }
            }
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
                $.when(result).done(ride(this, function(){
                    this._watchCallbacks(name, oldVal, value);
                }));
            }
        },

        "get" : function(name){
            return this._get(name, this._helper(name));
        },
        /**
         *
         */
        _get : function(name, helper){
            return $.isFunction(this[helper.getter]) ? this[helper.getter]() : this[name];
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
            if(!html||!data) return "";
            scope = scope || win;
            transform = transform ? ride(scope, transform) : function(v) { return v;};
            return html.replace(/\$\{([^\s\:\}]+)(?:\:([^\s\:\}]+))?\}/g, function(match, key, format){
                var value = getOBJ(key, false, data);
                if(format){
                    value = getOBJ(format, false, scope).call(scope, value, key);
                }
                return transform(value, key).toString();
            });
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
            this.propertyCallbacks = callbacks[name];
            if($.type(this.propertyCallbacks) !== "object"){
                this.propertyCallbacks = callbacks[name] = [];
            }
            this.propertyCallbacks.push(cb);

        },
        /**
         * unwatches a property for changes
         * @param cb
         */
        unwatch : function(cb){
            var index = $.inArray(cb, this.propertyCallbacks);
            if(index > -1){
                this.propertyCallbacks.splice(index, 1);
            }
        },

        notify : function(args, target){
            var suspect = args[0];
            if($.type(suspect) === "object"){
                if((suspect[0] && suspect[0].nodeType)||(suspect && suspect.nodeType)){
                    //get cb-node
                    var cbNode = $(suspect).attr(cobra.base.nodePrefix);
                    this._helper$(cbNode, suspect[0]||suspect);
                }
            }else if($.type(suspect) === "string"){
                try{

                }catch (e){
                    throw  new Error("Please make sure the fragment string is correct!");
                }
            }
        },
        request : function(){
            //
        },
        //interface can be implemented by sub-classes
        onBeforeBootStrap : noop,
        //interface can be implemented by sub-classes
        onPostBootStrap : noop,
        update : noop
    });
    //+++++++++++++++++++++++++A Base class pre-defined end+++++++++++++++++++++++++++
    //
    $(function(){
        var boot = new cobra.base({selector : ['.a']});
        var span = $("<span cb-node='test3'>test</span>");
        boot.$.test1.append(span);
        console.log(boot);
    });
})(jQuery, window);