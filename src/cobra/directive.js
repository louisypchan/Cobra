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
cobra.add('cobra/directive', ["lang"], function(lang){

    var directive = {
        //分割符
        sep : /([\:\-\_]+(.))/g,
        //
        tags : {
            ypController : 'C',
            ypTemplate   : 'T',
            ypVar        : "V",
            ypModel      : 'M'
        },
        //
        attrs : {
            ypVar : 'yp-var',
            ypTemplate : 'yp-template',
            ypController : 'yp-controller',
            ypModel : 'yp-model'
        },
        //父标示
        parent : '_$_$_parent_$_$_',
        //
        factories : {
            //
            ypController : {
                priority : 1,
                compile : function(node, attr, scope){
                    if(!node.$compiled){
                        var controller = "$" + attr.val;
                        this[controller] = {};
                        this[controller][directive.parent] = scope;
                        node.$attr = attr;
                        node.$scope = this[controller];
                        $(node).addClass(directive.tags.ypController);
                        node.$compiled = true;
                        return this[controller];
                    }
                    return this;
                }
            },
            //
            ypTemplate  : {
                priority : 2,
                compile : function(node, attr){
                    var templateId = attr.val;
                    if(this.__checkTemplate){
                        this.__checkTemplate(templateId);
                    }
                    $(node).addClass(directive.tags.ypTemplate);
                    node.$tmpl = this.templates[templateId];
                }
            },
            //
            ypVar : {
                priority : 3,
                compile : function(node, attr, scope){
                    if(!node.$compiled){
                        node.$scope = {};
                        var parent = $(node).parent(), isHTMLTag = false;
                        while(!$(parent).hasClass(directive.tags.ypTemplate)){
                            if($.nodeName(parent[0], "html")){ isHTMLTag = true; break; }
                            parent = $(parent).parent();
                        }
                        if(isHTMLTag) return;
                        node.$scope[attr.val] = scope[$(parent).attr(directive.attrs.ypModel)][node.$index];
                        node.$scope.$index = node.$index;
                        //TODO:
                        //node.$scope.$$watch = [];
                        $(node).addClass(directive.tags.ypVar);
                        node.$compiled = true;
                        return node.$scope;
                    }
                    return node.$scope;
                }
            },
            //
            ypModel: {
                priority : 4,
                compile : function(node, attr, scope){
                    if(!node.$compiled){
                        var expr = attr.val, parts = expr.split("."), tag = node.nodeName.toLowerCase();
                        lang.getProp(parts, true, scope);
                        if(tag === "input" || tag === "textarea" || tag === "select"){
                            if(lang.hasEvent("input")){
                                $(node).on("input", lang.ride(this,function(e){
                                    this.$set(expr, e.target.value, scope);
                                }));
                            }else{
                                //<=IE11
                                var origValue = "";
                                $(node).on("keydown", lang.ride(this, function(e){
                                    var key = e.which, target = e.target;
                                    // ignore
                                    // command  modifiers  arrows
                                    if (key === 91 || (15 < key && key < 19) || (37 <= key && key <= 40)) return;
                                    setTimeout(lang.ride(this,function(){
                                        if(target.value !== origValue){
                                            origValue = target.value;
                                            this.$set(expr, origValue, scope);
                                        }
                                    }), 0);
                                }));
                            }
                            // if user paste into input using mouse on older browser
                            // or form autocomplete on newer browser, we need "change" event to catch it
                            $(node).on("change", lang.ride(this, function(e){
                                this.$set(expr, e.target.value, scope);
                            }));
                        }
                        if(!node.$tmpl){
                            node.$$watcher = this.$watch(expr, function(value, $scope, idx){
                                if($.type(value) === "object" && lang.isEmpty(value)) return;
                                if(lang.isArraylike(value) && value.length == 0) return;
                                if(tag === "input" || tag === "textarea" || tag === "select"){
                                    $(node).val(value);
                                }else{
                                    value !== $.noop ? $(node).html(value) : ($(node).remove(), this.$destory(idx));
                                }
                            }, scope);
                        }else{
                            node.$$watcher = this.$watchCollection(expr, function(value, $scope){
                                if(!$scope.$initRun){
                                    if(typeof $scope.$newValue === "object" && lang.isEmpty($scope.$newValue)) return;
                                    if($.isArray($scope.$newValue) && $scope.$newValue.length == 0)  return;
                                    $scope.$initRun = true;
                                    $(node).html(lang.compile(node.$tmpl, $scope.$newValue)($scope.$newValue));
                                }else{
                                    var _childNodes = node.childNodes, _node;
                                    if(_childNodes){
                                        var i = 0, l = _childNodes.length, nl;
                                        if(lang.isArraylike($scope.$newValue)){
                                            nl = $scope.$newValue.length;
                                            for(; i < l; i++){
                                                _node = _childNodes[i];
                                                _node.$scope[$(_node).attr(directive.attrs.ypVar)] = $scope.$newValue[i];
                                                _node.$scope.$index = i;
                                                if($scope.$newValue[i] === undefined){
                                                    $(_node).remove();
                                                    //clear dirty watchers
                                                }
                                            }
                                            if(nl > l){
                                                var newAdded = $scope.$newValue.slice(i, nl);
                                                $(node).append(lang.compile(node.$tmpl,newAdded)(newAdded));
                                            }
                                        }else{

                                        }
                                    }else{
                                        $(node).html(lang.compile(node.$tmpl, $scope.$newValue)($scope.$newValue));
                                    }
                                }
                            }, scope);
                        }
                        node.$compiled = true;
                        node.$scope = scope;
                    }
                }
            }
        },
        /**
         * Collect the directives from the given node
         * @param node
         * @returns {Array}
         */
        collect : function(node){
            var results = [];
            if(!(node instanceof $)){
                node = $(node);
            }
            if(!node || !node[0]){
                return results;
            }
            node.each(function(){
                switch (this.nodeType){
                    case cobra.DOM.NODE_TYPE_ELEMENT :
                        //find directives through the attributes
                        var attrs = this.attributes, i = 0, l = attrs && attrs.length, attr, name, val;
                        for(; i < l; ){
                            attr = attrs[i++];
                            name = attr.name;
                            val = $.trim(attr.value);
                            name = name.replace(directive.sep, function(_, separator, letter, offset){ return offset ? letter.toUpperCase() : letter; });
                            results.push({
                                attr : {name : name, val : val},
                                tag : directive.tags[name],
                                priority : directive.factories[name] ? directive.factories[name].priority : 100,
                                compile : directive.factories[name] ? directive.factories[name].compile : cobra.noop
                            });
                        }
                        break;
                    case cobra.DOM.NODE_TYPE_TEXT :
                        //TODO:
                        break;
                }
            });
            //sort the collected directives by priority
            results.sort(function(a1, a2){
                var v1 = a1["priority"], v2 = a2["priority"];
                if(v1 < v2){
                    return -1;
                }else if(v1 > v2){
                    return 1;
                }else{
                    return 0;
                }
            });
            return results;
        }
    };

    return directive;
});