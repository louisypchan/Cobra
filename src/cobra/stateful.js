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
cobra.add('cobra/stateful', ["lang"], function(lang){

    function CollectionWatcher(expr, listener, scope, runtime){
        this.$newValue = null;
        this.$oldValue = null;
        this.$changeDetected = 0;
        this.$scope = scope;
        this.$expr = expr;
        this.$runtime = runtime || win;
        this.$oldLength = 0;
        this.$internalArray = [];
        this.$internalObject = {};
        this.$initRun = false;
        this.$listener = listener || cobra.noop;

        return {
            expr : expr,
            $new : this.interceptor,
            $runtime : this,
            $old : 0,
            $listener : this.$listener,
            $scope : scope
        };
    }

    CollectionWatcher.prototype.interceptor = function(){
        this.$newValue = this.$runtime.$get(this.$expr, this.$scope);
        var newLength, newItem, oldItem, bothNaN, key;
        if(this.$newValue === cobra.noop) return void(0);
        if($.type(this.$newValue) !== "object"){
            if(this.$oldValue !== this.$newValue){
                this.$oldValue = this.$newValue;
                this.$changeDetected++;
            }
        }else if(lang.isArraylike(this.$newValue)){
            if(this.$oldValue !== this.$internalArray){
                this.$oldValue = this.$internalArray;
                this.$oldLength = this.$oldValue.length = 0;
                this.$changeDetected++;
            }

            newLength = this.$newValue.length;
            if(this.$oldLength !== newLength){
                // if lengths do not match we need to trigger change notification
                this.$changeDetected++;
                this.$oldValue.length = this.$oldLength = newLength;
            }
            // copy the items to oldValue and look for changes.
            for (var i = 0; i < newLength; i++) {
                oldItem = this.$oldValue[i];
                newItem = this.$newValue[i];
                bothNaN = (oldItem !== oldItem) && (newItem !== newItem);
                if(!bothNaN && (oldItem !== newItem)){
                    this.$changeDetected++;
                    this.$oldValue[i] = newItem;
                }
            }
        }else{
            if(this.$oldValue !== this.$internalObject){
                this.$oldValue = this.$internalObject;
                this.$oldLength = 0;
                this.$changeDetected++;
            }
            // copy the items to oldValue and look for changes.
            newLength = 0;
            for(key in this.$newValue){
                if(this.$newValue[key]){
                    newLength++;
                    newItem = this.$newValue[key];
                    if (key in this.$oldValue) {
                        oldItem = this.$oldValue[key];
                        bothNaN = (oldItem !== oldItem) && (newItem !== newItem);
                        if (!bothNaN && (oldItem !== newItem)) {
                            this.$changeDetected++;
                            this.$oldValue[key] = newItem;
                        }
                    }else{
                        this.$oldLength++;
                        this.$oldValue[key] = newItem;
                        this.$changeDetected++;
                    }
                }
            }
            if(this.$oldLength > newLength){
                // we used to have more keys, need to find them and destroy them.
                this.$changeDetected++;
                for (key in this.$oldValue) {
                    if (!this.$newValue[key]) {
                        this.$oldLength--;
                        delete this.$oldValue[key];
                    }
                }
            }
        }
        return this.$changeDetected;
    };

    return     cobra._({
        //
        "~name" : "cobra.stateful",
        //
        "+PROPREGEX" : /[^\[\]]+/g,

        /**
         *  constructor
         */
        ctor : function(){
            this.__$$__watchers__$$__ = [];
            this.$dirtyChecking = true; //turn on the dirty checking
            cobra.aspect.before(this, "bootStrap", this.onBeforeBootStrap);
            cobra.aspect.after(this, "bootStrap", this.onPostBootStrap);
            cobra.aspect.after(this, "postCreate", this.$digest);
        },
        /**
         * get/set the value through the given expr
         * @param expr
         * @param value
         * @param scope
         * @returns {*}
         */
        $helper : function(expr, value, scope){
            var parts = expr.split("."), len = parts.length, last = parts[len - 1], val = null, p, i = 0, rs = scope, j = 0, l;
            while(rs && (p = parts[i++]) && i < len){
                j = 0;
                p = p.match(cobra.stateful.PROPREGEX);
                for(l = p.length; j < l; j++){
                    rs = rs[p[j]];
                }
            }
            if(rs === undefined) return cobra.noop;
            last = last.match(cobra.stateful.PROPREGEX);
            l = last.length;
            j = 0;
            for(; j < l - 1; j++){
                rs = rs[last[j]];
            }
            if(j=== (l -1)){
                val = rs[last[j]] === undefined ? cobra.noop : rs[last[j]];
                value !== undefined && (rs[last[j]] = value);
            }
            return val;
        },
        /**
         * get the value from the given expr
         * @param expr
         * @param scope
         * @returns {*}
         */
        $get : function(expr, scope){
            return this.$helper(expr, undefined, scope);
        },
        /**
         *
         * @param expr
         * @param value
         * @param scope
         */
        $set : function(expr, value, scope){
            this.$helper(expr, value, scope);
            this.$digest();
        },
        /**
         * watch
         * @param expr
         * @param listener
         * @param scope
         */
        $watch : function(expr, listener, scope){
            var watcher = {
                expr : expr,
                $new : this.$get,
                $runtime : this,
                $old : null,
                $listener : listener || cobra.noop,
                $scope : scope
            };
            if(this.$dirtyChecking){
                this.__$$__watchers__$$__.unshift(watcher);
            }
            return watcher;
        },
        /**
         * watch collection
         * @param expr
         * @param listener
         * @param scope
         */
        $watchCollection : function(expr, listener, scope){
            var watcher = new CollectionWatcher(expr, listener, scope, this);
            if(this.$dirtyChecking){
                //CollectionWatcher(expr, listener, scope, runtime){
                this.__$$__watchers__$$__.unshift(watcher);
            }
            return watcher;
        },
        /**
         * dirty checking
         */
        $digest : function(){
            if(!this.$dirtyChecking) return;
            var watch, len = this.__$$__watchers__$$__.length, scope, newVal, dirty,j;
            j = len-1;
            do{
                dirty = false;
                for(;j>=0;j--){
                    watch = this.__$$__watchers__$$__[j];
                    if(watch){
                        scope = watch.$scope;
                        if((newVal = watch.$new.call(watch.$runtime, watch.expr, scope)) != watch.$old){
                            dirty = true;
                            watch.$listener.apply(this, [newVal, watch.$runtime, j]);
                            watch.$old = newVal;
                        }else{
                            if(newVal === cobra.noop){
                                //the last time to publish the listener
                                watch.listener.apply(this, [newVal, watch.$runtime, j]);
                            }
                        }
                    }
                }
            }while(dirty);
        },
        /**
         *
         * @param idx
         */
        $destory : function(idx){
            var arity = arguments.length;
            if(arity === 0){
                this.__$$__watchers__$$__.length = 0;
            }else{
                this.__$$__watchers__$$__.splice(idx, 1);
            }
        },
        postCreate : cobra.noop,
        onBeforeBootStrap : cobra.noop,
        onPostBootStrap : cobra.noop
    });
});