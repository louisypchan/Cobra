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
 * Cobra is based on jQuery and doT
 */

//A mini Cobra JavaScript Library based on jQuery
(function($, win, T){
    //  we won't use strict mode here
    var doc = win.document,
        op = Object.prototype,
        noop = function(){},
        __uidSeed = 1,
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
    if(!IE && doc.attachEvent){
        //use userAgent to check IE's version
        IE = win.navigator.userAgent.match(/msie\s*(\d+)/i);
        if(IE){
            IE = IE[1];
        }else{
            IE = false;
        }
    }
    win.cobra = {};
    cobra.doc = doc;
    cobra.version = "{{version}}";
    cobra.ie = IE||doc.attachEvent;
    cobra.noop = noop;
    cobra.cfg = {
        debug : "{{debug}}"
    };
    //locale
    cobra.locale = "zh-cn";

    cobra.uid = function(){
        return "_" + __uidSeed++;
    };
    var DOMID = 17602;
    cobra.domUID = function(){
        return "cb_" + DOMID++;
    };
    cobra.config = {};
    //directive object:
    cobra.directive = {};
    //DOM constrants
    cobra.DOM = {
        NODE_TYPE_ELEMENT : 1,
        NODE_TYPE_TEXT : 3,
        NODE_TYPE_COMMENT : 8,
        NODE_TYPE_DOCUMENT : 9,
        NODE_TYPE_DOCUMENT_FRAGMENT : 11
    };
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
    function isEmpty(it){

        for(var p in it){
            return 0;
        }
        return 1;
    }
    function safeMix(dest, src){
        for(var p in src){
            if(p && p.indexOf("__") == 0){
                continue;
            }
            dest[p] = src[p];
        }
        return dest;
    }
    //This is a temporary function to  handler the diff event across the browsers
    //The event control will be moved to be an individual module
    var domOn = function (node, eventName, ieEventName, handler){
        // Add an event listener to a DOM node using the API appropriate for the current browser;
        // return a function that will disconnect the listener.
        if(window.addEventListener){
            node.addEventListener(eventName, handler, false);
            return function(){
                node.removeEventListener(eventName, handler, false);
            };
        }else{
            node.attachEvent(ieEventName, handler);
            return function(){
                node.detachEvent(ieEventName, handler);
            };
        }
    };
    function parse(html, data, transform, scope){
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
    }
    function escapeString(str, except){
        return str.replace(/([\.$?*|{}\(\)\[\]\\\/\+\-^])/g, function(ch){
            if(except && except.indexOf(ch) != -1){
                return ch;
            }
            return "\\" + ch;
        });
    }

    var eventSupport = {};
    function hasEvent(eventName){
        if(eventName === "input" && (cobra.ie && cobra.ie <= 11)) return false;
        if(!(eventSupport[eventName])){
            var divElm = doc.createElement('div');
            eventSupport[eventName] = 'on' + eventName in divElm;
            divElm = null;
        }
        return eventSupport[eventName];
    }

    function isArraylike( it ) {
        return it && it !== undefined &&
            // keep out built-in constructors (Number, String, ...) which have length
            $.type(it) !== "string"  && !$.isFunction(it) &&
            !(it.tagName && it.tagName.toLowerCase() == "form") &&
            ($.isArray(it) || isFinite(it.length));
    }

    var lang = {
        isArraylike : isArraylike,
        hasEvent : hasEvent,
        escapeString : escapeString,
        parse : parse,
        isEmpty : isEmpty,
        ride  : ride,
        getProp : getProp,
        compile : T.compile
    };
    //+++++++++++++++++++++++++A mini observe engine begin +++++++++++++++++++++++++++
    //check cookie supportive
    cobra.cookie = function(/*String*/name, /*String?*/ value, /*__cookieProps?*/ props){
        var c = document.cookie, ret;
        if(arguments.length == 1){
            var matches = c.match(new RegExp("(?:^|; )" + escapeString(name) + "=([^;]*)"));
            ret = matches ? decodeURIComponent(matches[1]) : undefined;
        }else{
            props = props || {};
            var exp = props.expires;
            if(typeof exp == "number"){
                var d = new Date();
                d.setTime(d.getTime() + exp*24*60*60*1000);
                exp = props.expires = d;
            }
            if(exp && exp.toUTCString){ props.expires = exp.toUTCString(); }
            value = encodeURIComponent(value);
            var updatedCookie = name + "=" + value, propName;
            for(propName in props){
                updatedCookie += "; " + propName;
                var propValue = props[propName];
                if(propValue !== true){ updatedCookie += "=" + propValue; }
            }
            document.cookie = updatedCookie;
        }
        return ret;
    };
    cobra.cookie.isSupported = function(){
        if(!("cookieEnabled" in navigator)){
            this("__cookieTest__", "CookiesAllowed");
            navigator.cookieEnabled = this("__cookieTest__") == "CookiesAllowed";
            if(navigator.cookieEnabled){
                this("__cookieTest__", "", {expires: -1});
            }
        }
        return navigator.cookieEnabled;
    };
    cobra.cookieSupported = cobra.cookie.isSupported();
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
                }catch (e){
                   throw e;
                }
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
                    //c[i]["_"+prop] = c[i][prop];
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
        //
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
                        f.executed || processSynthesize(f, this);
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
                //constructor the prototype
                f.prototype = rPorot;
                f.privates = privates;
                //crack static
                crackStatic(f);
                //
                rPorot._class = f;
                //synthesize properties
                //__synthesizes.push(f);
                //add name if specified
                if(clsName){
                    setObject(clsName, f);
                    rPorot._class._name = clsName;
                }
                //return
                return f;
            },
            processSynthesize = function(it, ctx){
                if(it){
                    it.executed || injectSynthesize(it, ctx);
                }
            },
            injectSynthesize = function (it, ctx){
                for(var i = 0 , synthesize = it._meta.synthesize, l = synthesize ? synthesize.length : 0; i < l; i++){
                    synthesizeProperty(it.prototype, synthesize[i], ctx);
                }
                it.executed = true;
            },
            synthesizeProperty = function (proto, prop, ctx){
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
                if(cobra.ie && cobra.ie < 9){
                    /**
                     // IE8 not all JavaScript Objects can use Object.defineProperty. This is so werid
                     // We have to chose another solution to support IE7 and IE8
                     // Here we consider that to use watch solution to simulate setter method
                     // That means when there is an asignment there will notify the specific method to be executed
                     // And consider that if we don't change to use function to minitor watching callbacks
                     // Here we go
                     */
                    cobra.observe.add(ctx, prop, mSet);
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

    //+++++++++++++++++++++++++JSON Schema begin+++++++++++++++++++++++++
    (function(){
         var validate = function(/*Any*/instance,/*Object*/schema,/*Boolean*/ _changing){
            var errors = [];
            // validate a value against a property definition
            function checkProp(value, schema, path,i){
                var l;
                path += path ? typeof i == 'number' ? '[' + i + ']' : typeof i == 'undefined' ? '' : '.' + i : i;
                function addError(message){
                    errors.push({property:path,message:message});
                }

                if((typeof schema != 'object' || schema instanceof Array) && (path || typeof schema != 'function')){
                    if(typeof schema == 'function'){
                        if(!(Object(value) instanceof schema)){
                            addError("is not an instance of the class/constructor " + schema.name);
                        }
                    }else if(schema){
                        addError("Invalid schema/property definition " + schema);
                    }
                    return null;
                }
                if(_changing && schema.readonly){
                    addError("is a readonly field, it can not be changed");
                }
                if(schema['extends']){ // if it extends another schema, it must pass that schema as well
                    checkProp(value,schema['extends'],path,i);
                }
                // validate a value against a type definition
                function checkType(type,value){
                    if(type){
                        if(typeof type == 'string' && type != 'any' &&
                            (type == 'null' ? value !== null : typeof value != type) &&
                            !(value instanceof Array && type == 'array') &&
                            !(type == 'integer' && value%1===0)){
                            return [{property:path,message:(typeof value) + " value found, but a " + type + " is required"}];
                        }
                        if(type instanceof Array){
                            var unionErrors=[];
                            for(var j = 0; j < type.length; j++){ // a union type
                                if(!(unionErrors=checkType(type[j],value)).length){
                                    break;
                                }
                            }
                            if(unionErrors.length){
                                return unionErrors;
                            }
                        }else if(typeof type == 'object'){
                            var priorErrors = errors;
                            errors = [];
                            checkProp(value,type,path);
                            var theseErrors = errors;
                            errors = priorErrors;
                            return theseErrors;
                        }
                    }
                    return [];
                }
                if(value === undefined){
                    if(schema.required){
                        addError("is missing and it is not optional");
                    }
                }else{
                    errors = errors.concat(checkType(schema.type,value));
                    if(schema.disallow && !checkType(schema.disallow,value).length){
                        addError(" disallowed value was matched");
                    }
                    if(value !== null){
                        if(value instanceof Array){
                            if(schema.items){
                                if(schema.items instanceof Array){
                                    for(i=0,l=value.length; i<l; i++){
                                        errors.concat(checkProp(value[i],schema.items[i],path,i));
                                    }
                                }else{
                                    for(i=0,l=value.length; i<l; i++){
                                        errors.concat(checkProp(value[i],schema.items,path,i));
                                    }
                                }
                            }
                            if(schema.minItems && value.length < schema.minItems){
                                addError("There must be a minimum of " + schema.minItems + " in the array");
                            }
                            if(schema.maxItems && value.length > schema.maxItems){
                                addError("There must be a maximum of " + schema.maxItems + " in the array");
                            }
                        }else if(schema.properties){
                            errors.concat(checkObj(value,schema.properties,path,schema.additionalProperties));
                        }
                        if(schema.pattern && typeof value == 'string' && !value.match(schema.pattern)){
                            addError("does not match the regex pattern " + schema.pattern);
                        }
                        if(schema.maxLength && typeof value == 'string' && value.length > schema.maxLength){
                            addError("may only be " + schema.maxLength + " characters long");
                        }
                        if(schema.minLength && typeof value == 'string' && value.length < schema.minLength){
                            addError("must be at least " + schema.minLength + " characters long");
                        }
                        if(typeof schema.minimum !== undefined && typeof value == typeof schema.minimum &&
                            schema.minimum > value){
                            addError("must have a minimum value of " + schema.minimum);
                        }
                        if(typeof schema.maximum !== undefined && typeof value == typeof schema.maximum &&
                            schema.maximum < value){
                            addError("must have a maximum value of " + schema.maximum);
                        }
                        if(schema['enum']){
                            var enumer = schema['enum'];
                            l = enumer.length;
                            var found;
                            for(var j = 0; j < l; j++){
                                if(enumer[j]===value){
                                    found=1;
                                    break;
                                }
                            }
                            if(!found){
                                addError("does not have a value in the enumeration " + enumer.join(", "));
                            }
                        }
                        if(typeof schema.maxDecimal == 'number' &&
                            (value.toString().match(new RegExp("\\.[0-9]{" + (schema.maxDecimal + 1) + ",}")))){
                            addError("may only have " + schema.maxDecimal + " digits of decimal places");
                        }
                    }
                }
                return null;
            }
            // validate an object against a schema
            function checkObj(instance,objTypeDef,path,additionalProp){

                if(typeof objTypeDef =='object'){
                    if(typeof instance != 'object' || instance instanceof Array){
                        errors.push({property:path,message:"an object is required"});
                    }

                    for(var i in objTypeDef){
                        if(objTypeDef.hasOwnProperty(i) && !(i.charAt(0) == '_' && i.charAt(1) == '_')){
                            var value = instance[i];
                            if(typeof value === "string"){
                                //avoid XSS attack
                                instance[i] = instance[i].replace(/<\/?script>/igm, "").replace(/<!--(.*?)(-->)?/igm,"");
                            }
                            var propDef = objTypeDef[i];
                            checkProp(value,propDef,path,i);
                        }
                    }
                }
                for(i in instance){
                    if(instance.hasOwnProperty(i) && !(i.charAt(0) == '_' && i.charAt(1) == '_') && objTypeDef && !objTypeDef[i] && additionalProp===false){
                        errors.push({property:path,message:(typeof value) + "The property " + i +
                            " is not defined in the schema and the schema does not allow additional properties"});
                    }
                    var requires = objTypeDef && objTypeDef[i] && objTypeDef[i].requires;
                    if(requires && !(requires in instance)){
                        errors.push({property:path,message:"the presence of the property " + i + " requires that " + requires + " also be present"});
                    }
                    value = instance[i];
                    if(objTypeDef && typeof objTypeDef == 'object' && !(i in objTypeDef)){
                        checkProp(value,additionalProp,path,i);
                    }
                    if(!_changing && value && value.$schema){
                        errors = errors.concat(checkProp(value,value.$schema,path,i));
                    }
                }
                return errors;
            }
            if(schema){
                checkProp(instance,schema,'',_changing || '');
            }
            if(!_changing && instance && instance.$schema){
                checkProp(instance,instance.$schema,'','');
            }
            return {valid:!errors.length,errors:errors};
        };
        cobra.validate = validate;
    })();
    //+++++++++++++++++++++++++JSON Schema end+++++++++++++++++++++++++++
    //+++++++++++++++++++++++++something about AMD start+++++++++++++++++++++++++++
    (function(v){
        /**
         *
         * @type {{state: {ERROR: number, ABANDON: number, INIT: number, REQUESTED: number, ARRIVED: number, EXECUTING: number, EXECUTED: number}}}
         * @private
         */
        v.__AMD = {
            //the states of module
            state : {
                "ERROR"     : 23, //error happens
                "ABANDON"   : 110, //not a module
                "INIT"      : 0,
                "REQUESTED" : 1, //appending a script element inito the document
                "ARRIVED"   : 2, //the script that contatined the module arrived
                "EXECUTING" : 3, //in process of traversing dependencies and ruinning factory
                "EXECUTED"  : 4 //factory has been exectued
            }
        };
        /**
         * @param cfg
         *      pid     : the package identifier to which the module belongs (e.g., "bl"); "" indicates the system or default package
         *      mid     : the fully-resolved (i.e., mappings have been applied) module identifier without the package identifier (eg:bl/dom/selector)
         *      url     : the URL from which the module was retrieved
         *      pack    : the package object of the package to which the module belongs
         *      executed: the state of the package object has been executed
         *      deps    : the dependency vector for this module (vector of modules objects)
         *      factory : the factory for this module
         *      result  : the result of the running the factory for this module
         *      plugin  : TODO:
         * @constructor
         */
        var Module = function(cfg){
            this.context = v.__AMD;
            this.pid = "";
            this.mid = "";
            this.url = "";
            this.pack = null;
            this.executed =  this.context.state.INIT;
            this.deps = {}; //
            this.factory = noop;
            this.result = null;
            this.attached =  this.context.state.INIT;
            this.plugin = null;
            $.extend(this, cfg);
        };
        /**
         *
         * @param name
         * @param refMod
         * @param packs
         * @param mods
         * @param aliases
         * @returns {*}
         */
        function getModInfo(name, refMod, packs, mods, aliases){
            var isRelative = /^\./.test(name), match, pid, pack, rs, url, midInPackage;
            if(/(^\/)|(\:)|(\.js$)/.test(name) || (isRelative && !refMod)){
                //not a module but just a URL of some sort
                return  new Module({
                    pid : 0,
                    mid : name,
                    pack : 0,
                    url : /\.js$/.test(name) ? name : name + ".js"
                });
            }else{
                //relative to reference module
                //get rid of any dots
                name = v.__AMD.pkg.redress(isRelative ? (refMod.mid + "/../" + name) : name);
                //make sure is that a relatvei path
                if(/^\./.test(name)){
                    throw new Error("irrationalPath", name);
                }
                //map the name
                //a1/a2 --> $0:a1/a2, $1:a1, $2:/a2, $3:a2
                match = name.match(/^([^\/]+)(\/(.+))?$/);
                pid = match ? match[1] : "";
                pack = v.__AMD.packs[pid];
                if(pack){
                    name = pid + "/" + (midInPackage = match[3] || pack.m);
                }else{
                    pid = "";
                }
                //search aliases
                //TODO:
                var hit = false;
                $.each(v.__AMD.aliases, function(index, aliasMap){
                    match = name.match(aliasMap[0]);
                    if(match && match.length > 0){
                        hit = $.isFunction(aliasMap[1]) ? name.replace(aliasMap[0], aliasMap[1]) : aliasMap[1];
                        return false;
                    }
                });
                if(hit){
                    return getModInfo(hit, 0, packs, mods, aliases);
                }
                rs = v.__AMD.mods[name];
                if(rs){
                    return v.__AMD.mods[name];
                }
            }
            if(pid){
                url = pack.path + "/" + midInPackage;
            }else{
                url = name;
            }
            // if result is not absolute, add baseUrl
            if(!(/(^\/)|(\:)/.test(url))){
                if(pid ){
                    url = pack.baseUrl ?  pack.baseUrl + url : v.__AMD.baseUrl + url;
                }else{
                    url = v.__AMD.baseUrl + url;
                }
            }
            url += ".js" + "?v=" + cobra.version;
            return new Module({
                pid : pid,
                mid : name,
                pack : pack,
                url : v.__AMD.pkg.redress(url)
            });
        }
        /**
         * Internal function only use by AMD
         * @param event
         * @param a1
         * @param a2
         * @param a3
         */
        function injectOnLoad(event, a1, a2, a3){
            event = event||window.event;
            var node = event.target||event.srcElement;
            if(event.type === "load" || /complete|loaded/.test(node.readyState)){
                a1 && a1();
                a2 && a2();
                a3 && a3();
            }
        }
        /**
         * A loader engine
         *
         * example:
         *          {
     *              pkgs : [{
     *                  name : "myapp",
        *               path : "/js/myapp",
        *               baseUrl : ""  //baseUrl to repleace the top parent baseUrl
     *              }]
     *          }
         *
         * @type {{}}
         */
        $.extend(v.__AMD, {

            baseUrl : "./",

            timeout : 15000,

            cache : false,

            cacheMaps : {}, //TODO

            checkCompleteGuard : 0,

            defOrder : 0, //

            defQ : [], // The queue of define arguments sent to loader.

            execQ : [], //The list of modules that need to be attacthed.

            hangQ : {}, // The set of modules upon which the loader is waiting for definition to arrive

            abortExec : {},

            injectingMod : 0,

            //the nodes used to locate where scripts are injected into the document
            insertPointSibling : 0,

            defaultCfg : {

                cache : false, //dev mode : false

                pkgs : [],
                async : true,  //do we need it????

                timeout : 7000  //by default is 7 seconds
            },

            sniffCfg : {}, //give vecfg as sniffed from script tag

            packs : {}, //a map from packageId to package configuration object

            aliases : [], //a vetor of pairs of [regexs or string, replacement] = > (alias, actual)


            /**
             *A hash:(mid) --> (module-object) the module namespace
             *The module-object can refer to Module class
             */
            mods : {
                "lang" : new Module({mid:"lang", executed : 4}),
                "public" : new Module({mid:"public", executed : 4}),
                "module"  :  new Module({mid:"module", executed : 4})
            },
            /**
             * Stores the modules which will be initialized at the end of laoder initialization
             */
            deferMods : [],

            guard : {
                checkComplete : function(/*Function*/process){
                    try{
                        v.__AMD.checkCompleteGuard++;
                        process();
                    }finally{
                        v.__AMD.checkCompleteGuard--;
                    }
                    //!v.__AMD.defQ.length && v.__lang.isEmpty(v.__AMD.hangQ)&& !v.__AMD.execQ.length && !v.__AMD.checkCompleteGuard
                },
                monitor : function(){
                    //keep going
                    if(v.__AMD.checkCompleteGuard) return;
                    this.checkComplete(function(){
                        for(var currentDefOrder, module, i = 0; i < v.__AMD.execQ.length;){
                            currentDefOrder = v.__AMD.defOrder;
                            module =  v.__AMD.execQ[i];
                            module.execute();
                            if(currentDefOrder != v.__AMD.defOrder){
                                // defOrder was bumped one or more times indicating something was executed
                                i = 0;
                            }else{
                                //nothing haapend; check the next module in the exec queue
                                i++;
                            }
                        }
                    });
                }
            },

            timer : {
                tId : 0,
                start : function(){
                    this.clear();
                    if(v.__AMD.timeout){
                        this.tId = win.setTimeout(ride(this, function(){
                            this.clear();
                            throw new Error("request timeout");
                        }), v.__AMD.timeout);
                    }
                },
                clear : function(){
                    this.tId && win.clearTimeout(this.tId);
                    this.tId = 0;
                }
            },

            pkg : {
                /**
                 * redress the path
                 * @param path
                 * @returns {string}
                 */
                redress : function(path){
                    //console.log(path);
                    if(!path) return "";
                    //reform the string
                    path = path.replace(/\\/g, '/').replace(/[^\/]+(?=\/)\//g, function($0){
                        return $0 == "./" ? "" : $0;
                    });
                    var cRegx = /[^\/]+\/\.\.\//g,
                        startWithRelative = (path.indexOf("../") === 0), prefix = "";
                    if(startWithRelative){
                        prefix = "../";
                        path = path.substr(prefix.length);
                    }
                    while(/\.\.\//.test(path) && path.indexOf("../") != 0){
                        path = path.replace(cRegx, function(){ return "" });
                    }
                    return prefix + path;
                },


                /**
                 *
                 * @param name
                 * @param refMod
                 */
                getModule : function(name, refMod){
                    if(!name) return null;
                    var match = name.match(/^(.+?)\>(.*)$/);
                    if(match){
                        //match[1] plugin module
                        //match[2] plulgin
                        //TODO: won't handle plugin here
                        //TODO: move to phase 2
                        //name was {plugin-module}>{plugin-resource}
                        //var plugin = this.getModule(match[1], refMod);
                    }else{
                        var rs = getModInfo(name, refMod, v.__AMD.packs, v.__AMD.mods, v.__AMD.aliases);
                        var mod = v.__AMD.mods[rs.mid];
                        if(mod) return mod;
                        return v.__AMD.mods[rs.mid] = rs;
                    }
                },
                /**
                 * agument package info
                 * @param pkg
                 */
                aumentPkgInfo : function(pkg){
                    //assumpation the package object passed in is full-resolved
                    var name = pkg.name;
                    pkg = $.extend({m:"m"}, pkg);
                    pkg.path = pkg.path ? pkg.path : name;
                    //
                    if(!pkg.m.indexOf("./")){
                        pkg.m = pkg.m.substr(2);
                    }
                    //put agumented pkg info in packs
                    v.__AMD.packs[name] = pkg;
                },


                /**
                 *
                 * Spring 1: we won't handle any cache mechanism here
                 * Spring 2: Add a configure attribute to handle a set of resources which forced to refresh by version
                 * Spring 3: TODO:
                 * @param cfg
                 * @param boot
                 * @param refMod
                 */
                configure : function(cfg, boot, refMod){
                    if(!cfg || cfg.length == 0) return;
                    //timeout timer
                    v.__AMD.timeout = cfg['timeout']|| v.__AMD.defaultCfg.timeout;
                    //if true, will generate a random number along with module to flush the cache
                    v.__AMD.cache = cfg['cache'] ||v.__AMD.defaultCfg.cache;
                    //augment the package info
                    cfg.pkgs = cfg.pkgs||[];
                    cfg.aliases = cfg.aliases||[];
                    $.each(cfg.pkgs, ride(this, function(index,pkg){
                        this.aumentPkgInfo(pkg);
                    }));
                    //map aliases
                    //override will happen if the key name is the same
                    //key name has to be unique
                    $.each(cfg.aliases, function(index, aliase){
                        if($.type(aliase[0]) === "string"){
                            aliase[0] = aliase[0].replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, function(str) { return "\\" + str });
                        }
                        v.__AMD.aliases.push([new RegExp("^" + aliase[0] + "$"), aliase[1]]);
                    });
                    if(cfg['debug']){
                        getProp(["__debug"], true, v).state = cfg['debug'];
                    }
                },

                context : {
                    init : function(name, dependencies, factory, refMod){
                        var mod, syntheticMid;
                        if($.isArray(name)){
                            syntheticMid = "use*" + cobra.uid();
                            //resolve the request list with respect to the reference module
                            for(var mid, deps = [], i = 0, l = name.length; i <l;){
                                mid = name[i++];
                                deps.push(v.__AMD.pkg.getModule(mid, refMod));
                            }
                            //construct a synthetic module to control execution of the request list
                            mod = $.extend(new Module({pid:"", mid:syntheticMid, pack:0, url:""}), {
                                attached : v.__AMD.state.ARRIVED,
                                deps : deps,
                                factory : factory||dependencies||noop
                            });
                            v.__AMD.mods[mod.mid] = mod;
                            //attach the module
                            mod.attachDeps();
                            //
                            var strict = v.__AMD.checkCompleteGuard;
                            v.__AMD.guard.checkComplete(function(){
                                mod.execute(strict);
                            });
                            if(!mod.executed){
                                // some deps weren't on board or circular dependency detected and strict; therefore, push into the execQ
                                v.__AMD.execQ.push(mod);
                            }
                            v.__AMD.guard.monitor();
                        }
                    },
                    exposeLang : function(){
                        return lang;
                    }
                },
                /**
                 * insert a script element to the insert-point element with src=url;
                 * apply callback upon detecting the script has loaded.
                 * @param url
                 * @param cb
                 * @param module
                 */
                inject : function(url, cb, module){
                    var node = module.script = doc.createElement("script");
                    var loadHandler = domOn(node, "load", "onreadystatechange", function(e){
                        injectOnLoad(e, loadHandler, errorHandler, cb);
                    });
                    var errorHandler = domOn(node, "error", "onerror", function(e){
                        injectOnLoad(e, loadHandler, errorHandler, function(){
                            throw new Error("Inject script error from : " + url);
                        });
                    });
                    node.type = "text/javascript";
                    node.charset = "utf-8";
                    node.src = url;
                    v.__AMD.insertPointSibling.parentNode.insertBefore(node, v.__AMD.insertPointSibling);
                    return node;
                },
                /**
                 *
                 * @param refMod
                 */
                runDefQ : function(refMod){
                    // defQ is an array of [id, dependencies, factory]
                    var definedModules = [],
                        module, args;
                    while(v.__AMD.defQ.length){
                        args = v.__AMD.defQ.shift();
                        module = (args[0] && this.getModule(args[0]))||refMod;
                        definedModules.push([module, args[1], args[2]]);
                    }
                    $.each(definedModules, ride(this, function(index, args){
                        var module = this.defineModule.apply(this, args);
                        module.attachDeps();
                    }));
                },
                /**
                 *
                 * @param module
                 * @param deps
                 * @param factory
                 */
                defineModule : function(module, deps, factory){
                    if(module.attached == v.__AMD.state.ARRIVED){
                        //TODO:
                        throw new Error("module multiple define");
                        return module;
                    }
                    //mix
                    $.extend(module,{
                        deps : deps,
                        factory : factory,
                        //common js module identifier
                        cjs : {
                            "id" : module.mid,
                            "uri" : module.url,
                            "public" : (module.result = {}),
                            //
                            "config" : function(){
                                return module.config;
                            }
                        }
                    });
                    //resolve deps with respect to this module
                    for(var i = 0; deps[i]; i++){
                        deps[i] = this.getModule(deps[i], module);
                    }
                    module.arrived();
                    if(!$.isFunction(factory) && !deps.length){
                        module.result = factory;
                        module.done();
                    }
                    return module;
                }
            }
        });

        /**
         * properties of Module
         */
        $.extend(Module.prototype, {
            /**
             * when appending a script element inito the document
             */
            requested : function(){
                this.attached = this.context.state.REQUESTED;
                this.context.hangQ[this.mid] = 1;
                if(this.url){
                    this.context.hangQ[this.url] = this.pack||1;
                }
                this.context.timer.start();
            },
            /**
             * the script that contatined the module arrived
             */
            arrived : function(){
                this.attached = this.context.state.ARRIVED;
                delete this.context.hangQ[this.mid];
                if(this.url){
                    delete this.context.hangQ[this.url];
                }
                if(isEmpty(this.context.hangQ)){
                    this.context.timer.clear();
                }
            },
            /**
             *Attach the dependencies of the module
             */
            attachDeps : function(){
                var that = this;
                this.context.guard.checkComplete(ride(this, function(){
                    $.each(that.deps, function(index, dep){
                        dep.attach();
                    });
                }));
            },
            /**
             * Attach the module
             */
            attach : function(){
                var mid = this.mid, url = this.url;
                if(this.executed || this.attached || this.context.hangQ[mid]||
                    (this.url && (this.pack && this.context.hangQ[this.url] === this.pack) ||
                        this.context.hangQ[this.url] == 1)){
                    return;
                }
                this.requested();
                //all we done is only to support AMD mode
                //so in this mode, the module will be attached by script injection
                this.context.injectingMod = this;
                this.context.pkg.inject(url, ride(this, function(){
                    var context = this.context;
                    context.pkg.runDefQ(this);
                    if(this.attached !== context.state.ARRIVED){
                        this.arrived();
                        //TODO:is it necessary ????
                        $.extend(this, {
                            attached : context.state.ARRIVED,
                            executed : context.state.EXECUTED
                        });
                    }
                    context.guard.monitor();
                }), this);
                this.context.injectingMod = 0;
            },
            /**
             * Attach the module
             * @param strict : execute in strict mode or not
             */
            execute : function(strict){
                if(this.executed === this.context.state.EXECUTING){
                    // run the dependency vector, then run the factory for module
                    // TODO:
                    return this.context.abortExec;
                }
                if(!this.executed){
                    if(this.factory === noop){
                        return this.context.abortExec;
                    }
                    var deps = this.deps||[],
                        arg, argRS, args = [], i = 0;
                    this.executed = this.context.state.EXECUTING;
                    while((arg = deps[i++])){
                        // for circular dependencies, assume the first module encountered was executed OK
                        // modules that circularly depend on a module that has not run its factory will get
                        // an empty object(module.result = {}). They can take a reference to this object and/or
                        // add properties to it. When the module finally runs its factory, the factory can
                        // read/write/replace this object. Notice that so long as the object isn't replaced, any
                        // reference taken earlier while walking the deps list is still valid.
                        argRS = (arg === this.context.mods["lang"]) ? this.context.pkg.context.exposeLang() :
                            (arg === this.context.mods["public"]) ? (this.cjs && this.cjs.public) :
                                (arg === this.context.mods["module"]) ? this.cjs : arg.execute(strict);

                        //
                        if(argRS === this.context.abortExec){
                            this.executed = this.context.state.INIT;
                            return this.context.abortExec;
                        }
                        args.push(argRS);
                    }
                    //
                    this.runFactory(args);
                    this.done();
                }
                return this.result;
            },
            /**
             *
             * @param args
             */
            runFactory : function(args){
                var result = $.isFunction(this.factory) ? this.factory.apply(null, args) : this.factory;
                this.result = result ? result : (this.cjs ? this.cjs["public"] : {});
            },

            done : function(){
                this.executed = this.context.state.EXECUTED;
                this.defOrder = this.context.defOrder++;
                //TODO: plugin
                //remove all occurrences of this module from the execQ
                for(var i = 0; i < this.context.execQ.length;){
                    if(this.context.execQ[i] === this){
                        this.context.execQ.splice(i,1);
                    }else{
                        i++;
                    }
                }
                //delete references to sythentic modules
                if(/^use\*/.test(this.mid)){
                    delete this.context.mods[this.mid];
                }
            }
        });

        //var logger = v.logger("Bolin/AMD");
        /**
         *
         * @type {{defalutDeps: string[], use: use, add: add}}
         */
        v.__AMD.BoLin = {

            defalutDeps : ["lang", "public", "module"],

            /**
             * Summary:
             *      Won't support synchronize mode here
             *      So we assume that all the modules have been well-defined before calling use method
             *
             * Description:
             *
             * @param name(Array) an array of module names
             * @param deps
             * @param factory
             */
            use : function(name, deps, factory){
                v.__AMD.pkg.context.init(name, deps, factory);
            },
            /**
             *
             * @param name
             * @param deps
             * @param factory
             *
             * eg: def("lang");
             */
            add : function(name, deps, factory){
                var l = arguments.length,
                    args = [0, name, deps];
                if(l == 1){
                    args = [0, $.isFunction(name) ? this.defalutDeps :[], name];
                }else if(l == 2 && $.type(name) === "string"){
                    args = [name, $.isFunction(deps) ? this.defalutDeps :[], deps];
                }else if(l == 3){
                    args = [name, deps, factory];
                }

                if(args[1] === this.defalutDeps){
                    //Remove comments from the callback string,
                    //look for use calls, and pull them into the dependencies,
                    //but only if there are function args.
                    args[2].toString().replace(/(\/\*([\s\S]*?)\*\/|\/\/(.*)$)/mg, "").replace(/[^.]\s*use\s*\(\s*["']([^'"\s]+)["']\s*\)/g, function(match, dep){
                        //
                        args[1].push(dep);
                    });
                }
                var targetModule = args[0] && v.__AMD.pkg.getModule(args[0]), mod;
                if(targetModule && !v.__AMD.hangQ[targetModule.mid]){
                    mod = v.__AMD.pkg.defineModule(targetModule, args[1], args[2]);
                    mod.attachDeps();
                }else if(IE===false){
                    v.__AMD.defQ.push(args);
                }else{
                    //add IE support
                    //TODO: re-build  in next version
                    targetModule = targetModule || v.__AMD.injectingMod;
                    if(!targetModule){
                        for(name in v.__AMD.hangQ){
                            var module = v.__AMD.mods[name];
                            if(module && module.script && module.script.readyState === "interactive"){
                                targetModule = module;
                                break;
                            }
                        }
                    }
                    if(targetModule){
                        mod = v.__AMD.pkg.defineModule(targetModule, args[1], args[2]);
                        mod.attachDeps();
                    }
                    v.__AMD.guard.monitor();
                }
            }
        };

        //only for easy use
        v.use = v.__AMD.BoLin.use;
        v.add = v.__AMD.BoLin.add;
        v.config = v.__AMD.pkg.configure;
    })(cobra);
    //+++++++++++++++++++++++++something about AMD end+++++++++++++++++++++++++++
    //looks for a src attribute ending in cobra.js
    (function(v){
        //
        var scripts = doc.getElementsByTagName("script"),
            i = 0, l = scripts.length, script,src, match;
        while(i < l){
            script = scripts[i++];
            if((src = script.getAttribute("src")) && (match = src.match(/(((.*)\/)|^)cobra\.js(\W|$)/i))){
                //sniff bl dir and baseUrl
                //v.__loader.baseUrl = (match[3] + "/") ||"./";
                v.__AMD.baseUrl = (match[3] + "/") || "./";
                //remember an inster point sibling
                v.__AMD.insertPointSibling = script;
            }
            if(src = script.getAttribute("cbcfg")){
                v.__AMD.sniffCfg = v.eval("({ " + src + " })");
                //remember an inster point sibling
                v.__AMD.insertPointSibling = script;
            }

        }
    })(cobra);
    //+++++++++++++++++++++++++Embedbed message box begin +++++++++++++++++++++++++++
    var $msgBox;
    (function(){
        function msgBox(){
            this._done = '<div cb-type="warn"><i class="iconfont">&#xf0156;</i><span>${msg}</span><span cb-type="close"><i class="iconfont">&#xf00b3;</i></span></div>';
            this._warn = '<div cb-type="warn"><i class="iconfont">&#xf0153;</i><span>${msg}</span><span cb-type="close"><i class="iconfont">&#xf00b3;</i></span></div>';
            this._info = '<div cb-type="info"><i class="iconfont">&#xf0142;</i><span>${msg}</span><span cb-type="close"><i class="iconfont">&#xf00b3;</i></span></div>';
            this._error = '<div cb-type="error"><i class="iconfont">&#xf0155;</i><span>${msg}</span><span cb-type="close"><i class="iconfont">&#xf00b3;</i></span></div>';
            this.wrapper = $('<div style="position:fixed;top:0;left:50%;width:400px;margin-left:-200px;padding:6px 10px;z-index:9999;opacity:0.97;"></div>');
            this.background = "#428bca";
            this.init();
        }
        $.extend(msgBox.prototype, {
            init : function(){
                $(document.body).append(this.wrapper);
                this.handleEvent();
            },
            _setStyle : function(it){
                it.css({
                    'margin' : '4px 0',
                    'color' : '#fff',
                    'padding': '6px 28px 6px 10px',
                    'border-radius': '4px',
                    'line-height' : '1.3em',
                    'font-size' : '13px',
                    'position' : 'relative',
                    'transform' : 'rotateX(-90deg) translateZ(20px) scale(1)',
                    'transition' : '0.6s',
                    'overflow' : 'hidden',
                    'background' : this.background
                });
                var close = it.find("span[cb-type=close]");
                close.css({
                    'position' : 'absolute',
                    'display' : 'block',
                    'right' : '-24px',
                    'top' : '0',
                    'width' : '24px',
                    'height' : '100%',
                    'cursor' : 'pointer',
                    'transition' : 'right 0.15s',
                    'background' : 'rgba(255, 255, 255, 0.2)',
                    'filter' : 'progid:DXImageTransform.Microsoft.gradient(startColorstr=#ffffff20,endColorstr=#ffffff20)'
                });
                close.find("i").css({
                    'font-size' : '12px',
                    'position' : 'absolute',
                    'top' : '50%',
                    'margin-top' : '-8px',
                    'left' : '50%',
                    'margin-left' : '-6px'
                });

            },
            handleEvent : function(){
                var self = this;
                this.wrapper.mouseenter(function(){
                   $(this).find("span[cb-type=close]").css({right : 0});
                }).mouseleave(function(){
                    $(this).find("span[cb-type=close]").css({right : '-24px'});
                }).click(function(){
                    self._remove($(this));
                });
            },
            info : function(msg){
                this.background = "#428bca";
                this.$info = $(parse(this._info, {msg : msg}));
                this.wrapper.append(this.$info);
                this._setStyle(this.$info);
                var self = this;
                this._show(this.$info);
            },
            warn : function(msg){
                this.background = "#f0ad4e";
                this.$warn = $(parse(this._warn, {msg : msg}));
                this.wrapper.append(this.$warn);
                this._setStyle(this.$warn);
                var self = this;
                this._show(this.$warn);
            },
            error : function(msg){
                this.background = "#d9534f";
                this.$error = $(parse(this._error, {msg : msg}));
                this.wrapper.append(this.$error);
                this._setStyle(this.$error);
                this._show(this.$error);
            },
            done : function(msg){
                this.background = "#5cb85c";
                this.$done = $(parse(this._done, {msg : msg}));
                this.wrapper.append(this.$done);
                this._setStyle(this.$done);
                this._show(this.$done);
            },
            _remove : function($d){
                $d.css({
                    'height' : '0',
                    'padding' : '0 28px 0 10px',
                    'opacity' : '0',
                    'transition' : '0.4s'
                });
                var tl = setTimeout(function(){
                    if(tl){
                        clearTimeout(tl);
                    }
                    $d.remove();
                }, 400);
            },
            _show : function(it){
                var self = this;
                setTimeout(function(){
                    it.css({'transform' : 'rotateX(0deg) translateZ(45px) scale(1)'});
                });
                setTimeout(function(){
                    self._remove(it);
                }, 4000);
            }
        });
        cobra.msgBox = $msgBox = msgBox;
    })();
    //+++++++++++++++++++++++++Embedbed message box end +++++++++++++++++++++++++++
    (function(v){
        typeof console !== "undefined" || (win.console = {});
        var mds = [
            "assert", "count", "debug", "dir", "dirxml", "error", "group",
            "groupEnd", "info", "profile", "profileEnd", "time", "timeEnd",
            "trace", "warn", "log"
        ];
        var tn, i = 0, origins = {};
        while((tn = mds[i++])){
            if(!console[tn]){
                (function(method){
                    console[method] = ("log" in console) && v.cfg.debug === "true" ? function(){
                        var a = Array.prototype.slice.call(arguments);
                        a.unshift(method + ":");
                        console["log"](a.join(" "));
                    } : noop;
                })(tn);
            }else{
                if(v.cfg.debug === "false"){
                    console[tn] = noop;
                }
            }
        }
    })(cobra);
    //boot start
    cobra.boot = function(config) {
        cobra.__AMD.pkg.configure(cobra.__AMD.defaultCfg);
        cobra.__AMD.pkg.configure(config);
        cobra.__AMD.pkg.configure(cobra.__AMD.sniffCfg);
    }
    //before booting, set AMD user config
    cobra.boot(cobraCfg);
    cobra.ride = ride;
    cobra = safeMix({},cobra);
})(jQuery, window, doT);
//navigation common handle
//$(function(){
//    $("ul.seller-nav-main").on("mouseenter" , ">li.ui-nav-item" , function(){
//        if(!$(this).hasClass("ui-nav-item-current")){
//            $(this).find(">ul.ui-nav-submain").addClass("preview").css({left : 'auto'});
//            $(this).find(">a").addClass("preview");
//        }
//    }).on("mouseleave", ">li.ui-nav-item", function(){
//        if(!$(this).hasClass("ui-nav-item-current")){
//            $(this).find(">ul.ui-nav-submain").removeClass("preview");
//            $(this).find(">a").removeClass("preview");
//        }
//    });
//    //TODO: move to common place to handle the user name
//    if(cobra.cookieSupported){
//        var userName = cobra.cookie("username");
//        $("#login-status").find("a.account").html(userName);
//    }
//});