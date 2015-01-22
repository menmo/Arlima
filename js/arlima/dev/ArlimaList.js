var ArlimaList = (function($, window, ArlimaJS, ArlimaBackend, ArlimaUtils) {

    'use strict';

    var $document = $(document);

    /**
     * @param {Object} data
     * @constructor
     */
    function ArlimaList(data) {
        this.$elem = $(_getListHtml(data));
        this._isUnsaved = false;
        this._hasLoadedScheduledVersion = false;
        var _self = this,
            $articles = this.$elem.find('.articles');

        this.$elem
            .resizable({
                containment: 'parent',
                start : function() {
                    _self.$elem.css('overflow', 'hidden');
                    $articles.css('overflow-y', 'hidden');
                    $articles.find('.article').css('visibility', 'hidden');
                },
                stop : function() {
                    _self.$elem.css('overflow', 'visible');
                    _self.$elem.trigger('resized');
                    $articles.find('.article').css('visibility', 'visible');
                    $articles
                        .css('height', '100%')
                        .css({
                            height : $articles.height()+'px',
                            overflowY : 'auto'
                        });
                }
            })
            .draggable({
                containment: 'parent',
                snap: 20,
                handle: '.header',
                stop : function() {
                    _self.$elem.trigger('dragged');
                }
            });

        if( data.isImported ) {
            this.$elem.addClass('imported');

            setTimeout(function() {
                _self.$elem.find('.article .remove').remove();
                _self.$elem.find('.footer .save').remove();
                _self.$elem.find('.footer .preview').remove();
            }, 50);

            var reloadInterval = setInterval(function() {
                _self.reload();
            }, 90000);
            this.$elem.bind('removedFromContainer', function() {
                clearInterval(reloadInterval);
            })

        }

        this.$elem
            .bind('Arlima.addedToContainer', function() {
                // Needed for scroll to work
                $articles.css('height', $articles.height()+'px');
                arlimaNestedSortable(_self);
            });

        this.setData(data);

        _addEventListeners(this);

        this.$elem.get(0).arlimaList = this;
    }

    /**
     * @returns {String}
     */
    ArlimaList.prototype.toString = function() {
        return '"' +this.data.title+ '" (id:'+this.data.id+')';
    };

    /**
     * @param message
     * @param removeInSeconds
     * @param txtColor
     */
    ArlimaList.prototype.displayTitleMessage = function(message, removeInSeconds, txtColor) {
        if( message ) {
            this.$elem.find('.schedule-notice')
                .css('color', txtColor || '#999')
                .html('('+ message +')')
                .blink( removeInSeconds ? (removeInSeconds*1000):false );
        } else {
            this.$elem.find('.schedule-notice').html('');
        }
    };

    /**
     * @return {Array}
     */
    ArlimaList.prototype.getArticleData = function() {
        var articles = [];
        this.$elem.find('.article').each(function() {
            if( this.arlimaArticle.isChild() ) {
                articles[parseInt(this.arlimaArticle.data.parent, 10)].children.push(this.arlimaArticle.data);
            } else {
                this.arlimaArticle.data.children = []; // will become populated by this iteration
                articles.push(this.arlimaArticle.data);
            }
        });
        return articles;
    };

    /**
     * Returns the number of articles in the list
     * @returns {Number}
     */
    ArlimaList.prototype.size = function() {
        return this.$elem.find('.article').length;
    };

    /**
     * @returns {Number}
     */
    ArlimaList.prototype.numSections = function() {
        return this.$elem.find('.article.section-divider').length;
    };

    /**
     * @param {Array} articles
     */
    ArlimaList.prototype.setArticles = function(articles) {
        this.$elem.find('.articles').html('');
        var _self = this,
            addRemoveButton = !this.data.isImported;

        $.each(articles, function(i , articleData) {
            _self.addArticle(new ArlimaArticle(articleData, _self.data.id, false, addRemoveButton), false);
            if( articleData.children.length > 0 ) {
                $.each(articleData.children, function(j, childArticleData) {
                    var childArticle = new ArlimaArticle(childArticleData, _self.data.id, false, addRemoveButton);
                    childArticle.$elem.addClass('list-item-depth-1');
                    _self.addArticle(childArticle, false);
                });
            }
        });
    };

    /**
     * @param {ArlimaArticle} article
     * @param {Boolean} [toggleUnsavedState]
     */
    ArlimaList.prototype.addArticle = function(article, toggleUnsavedState) {
        this.$elem.find('.articles').append(article.$elem);
        article.listID = this.data.id;

        $document.trigger("Arlima.articleAdded", article);

        if( toggleUnsavedState )
            this.toggleUnsavedState(true);
    };

    /**
     * Create and open a preview version of this list
     */
    ArlimaList.prototype.preview = function() {
        window.ArlimaListPreview.preview(this);
    };

    /**
     * @param {Object} data
     */
    ArlimaList.prototype.setData = function(data) {
        this.data = data;
        var title = data.title;

        var $titleNode = this.$elem.find('.header .title');
        if($.trim($titleNode.text()) != title ) {
            $titleNode.text(title);
        }

        $titleNode.find('.schedule-clock').remove();
        $titleNode.removeClass('scheduled');

        if (data.version.status == 3) {
            $('<i class="fa fa-clock-o schedule-clock">&nbsp;</i>').prependTo($titleNode);
            $titleNode.addClass('scheduled');
        }

        if( (ArlimaJS.isAdmin || ArlimaJS.allowEditorsCreateSections) && data.options.supports_sections && !data.isImported ) {
            this.$elem.find('.add-section').show();
        } else {
            this.$elem.find('.add-section').hide();
        }

        _displayVersionInfo(this);
    };

    /**
     * @param {Boolean} isUnsaved
     */
    ArlimaList.prototype.toggleUnsavedState = function(isUnsaved) {
        isUnsaved = isUnsaved === true; // typecast
        if(isUnsaved != this._isUnsaved) { // state changed
            this._isUnsaved = isUnsaved;
            var $title = this.$elem.find('.header .title'),
                    $saveFutureSelectOption = this.$elem.find('.previous-versions li.future');
            $title.find('.dot').remove();

            if(this._isUnsaved) {
                this.$elem.addClass('unsaved');
                $title.prepend('<span class="dot">&nbsp;</span>');
                this.$elem.find('.previous-versions .future.save').removeClass('disabled')
                this.displayTitleMessage(false);
            }
            else {
                this.$elem.removeClass('unsaved');
                this.$elem.find('.previous-versions .future.save').addClass('disabled')
            }
        }
    };

    /**
     * @param {Boolean} toggle
     */
    ArlimaList.prototype.toggleAjaxPreLoader = function(toggle) {
        _toggleAjaxPreloader(this, toggle);
    };

    /**
     *
     * @param {Number} version
     */
    ArlimaList.prototype.deleteScheduledVersion = function(version) {
        var _self = this,
            doReload = this.data.version.id == version;

        window.ArlimaListLoader.deleteScheduledVersion(version, function() {
            if( doReload ) {
                _self.reload();
            }
            else {
                $.each(_self.data.scheduledVersions, function(i, obj) {
                    if( obj.id == version ) {
                        _self.data.scheduledVersions.splice(i, 1);
                        return false;
                    }
                });
                _displayVersionInfo(_self);
            }
        });
    };

    /**
     * Reload the latest version or a specific version
     * @param {Number} [version]
     */
    ArlimaList.prototype.reload = function(version, callback) {
        // preset
        var _self = this;
        this.loadedVersion = version;

        ArlimaUtils.log('Reloading list '+this+' with version '+version);

        // Clear form perhaps
        if( window.ArlimaArticleForm.isEditing(this.data.id) ) {
            window.ArlimaArticleForm.clear();
        }

        // Toggle state

        var isChanged = (version && version != this.data.version.id) ? true:false;

        _toggleAjaxPreloader(this, true);

        // Load the version of the list
        window.ArlimaListLoader.load(this, function() {
            _toggleAjaxPreloader(_self, false);

            if (_self.data.version.status == 3) { // editing scheduled
                isChanged = false;
                _self._hasLoadedScheduledVersion = true;
                _self.displayTitleMessage(false);
            } else {
                _self._hasLoadedScheduledVersion = false;
            }

            if (_self.loadedVersion == _self.data.versions[0].id) { // changed to latest version
                isChanged = false;
            }

            _self.toggleUnsavedState(isChanged);

            if( typeof callback == 'function' )
                callback(_self);

        }, version);
    };

    /**
     * @return {Boolean}
     */
    ArlimaList.prototype.hasUnsavedChanges = function() {
        return this._isUnsaved;
    };

    ArlimaList.prototype.hasLoadedScheduledVersion = function() {
        return this._hasLoadedScheduledVersion;
    };

    /**
     * Goes through all articles that is set as future and check
     * if they're still future articles
     */
    ArlimaList.prototype.fixFutureNotices = function() {
        this.$elem.find('.future').each(function() {
            if( this.arlimaArticle && this.arlimaArticle.isPublished() ) {
                this.arlimaArticle.updateItemPresentation();
            }
        });
    };

    /**
     * @return {ArlimaArticle}
     */
    ArlimaList.prototype.article = function(index) {
        return this.$elem.find('.article').get(index).arlimaArticle;
    };

    ArlimaList.prototype.dump = function() {
        this.$elem.find('.article').each(function() {
            ArlimaUtils.log(this.arlimaArticle);
        });
    };

    /**
     * Save current list as a new version
     * @param {Date} scheduleDate
     */
    ArlimaList.prototype.save = function(scheduleDate) {

        var _self = this,
            whenSaved = function(data) {
                _toggleAjaxPreloader(_self, false);
                if( data ) {
                    _self.loadedVersion = data.loadedVersion;
                    _self.data.version = data.version;
                    _self.data.versions = data.versions;
                    _self.data.versionDisplayText = data.versionDisplayText;
                    _self.data.scheduledVersions = data.scheduledVersions;
                    _self.data.version.scheduled = parseInt(_self.data.version.scheduled, 10);

                    if( !scheduleDate ) {
                        _self._hasLoadedScheduledVersion = false;
                    } else {
                        _self._hasLoadedScheduledVersion = true;
                    }

                    if( window.ArlimaArticleForm.isEditing(_self.data.id) ) {
                        window.ArlimaArticleForm.toggleUnsavedState('saved');
                    }

                    _displayVersionInfo(_self);
                }
            };

        if( this.hasUnsavedChanges() ) {

            this.toggleUnsavedState(false);
            _toggleAjaxPreloader(this, true);

            if( this.hasLoadedScheduledVersion() ) {
                // currently editing a future version
                ArlimaBackend.updateListVersion(this.data.id, this.data.version.id,  this.getArticleData(), function() {
                    _toggleAjaxPreloader(_self, false);
                    if( window.ArlimaArticleForm.isEditing(_self.data.id) ) {
                        window.ArlimaArticleForm.toggleUnsavedState('saved');
                    }
                });
            } else {

                delete this.loadedVersion; // No specific version loaded means we're on the latest created version

                var scheduleTime = '';

                if (scheduleDate) {
                    scheduleTime = Math.round(scheduleDate.getTime() / 1000); // Get Unix timestamp of Date if scheduled
                }

                ArlimaBackend.getLaterVersion(this.data.id, this.data.version.id, function(json) {
                    if(json) {
                        var saveList = true;
                        if(json.version && !scheduleTime) {
                            // has newer version
                            saveList = confirm(ArlimaJS.lang.laterVersion + ' \r\n ' + json.versioninfo + '\r\n' + ArlimaJS.lang.overWrite);
                        }
                        if( _self.$elem.find('.streamer-extra').length > 1) {
                            // has many extra
                            saveList = confirm( ArlimaJS.lang.severalExtras + '\r\n' +  ArlimaJS.lang.overWrite);
                        }

                        if( !saveList ) {
                            _toggleAjaxPreloader(_self, false);
                        } else {
                            window.ArlimaListLoader.save(_self, scheduleTime, whenSaved);
                        }
                    }
                });
            }
        }
    };

    /**
     * Goes through all articles in the list and updates the parent properties
     * of the child articles
     */
    ArlimaList.prototype.updateParentProperties = function() {
        var parentIndex = -1;
        this.$elem.find('.article').each(function() {
            var $article = $(this);
            if( $article.hasClass('list-item-depth-1') ) {
                this.arlimaArticle.data.parent = parentIndex;
            } else {
                this.arlimaArticle.data.parent = '-1';
                parentIndex++;
            }
            this.arlimaArticle.children = [];
        });
    };

    /* * * * *  Private methods * * * * */

    /**
     * Make version info available in the list element
     * @param {ArlimaList} list
     */
    var _displayVersionInfo = function(list) {
        if(list.data.isImported) {
            list.$elem.find('.version .number').text(list.data.versionDisplayText);
        }
        else {
            var $versionWrapper = list.$elem.find('.version .number'),
                $versionList = list.$elem.find('.previous-versions'),
                loadedVersionID = list.loadedVersion || list.data.version.id,
                listContainsSchedule = list.data.scheduledVersions.length > 0,
                $imgClockIcon = $('<i>&nbsp;</i>')
                        .attr('class', 'fa fa-clock-o schedule-clock')
                        .attr('title', ArlimaJS.lang.scheduledVersions)
                        .attr('alt', ArlimaJS.lang.scheduledVersions);

            $versionWrapper
                .html('v. '+loadedVersionID)
                .attr('title', list.data.versionDisplayText)
                .qtip({
                    position: {
                        my: 'right top',
                        at: 'center left',
                        viewport: jQuery(window)
                    },
                    style: window.qtipStyle
                });

            list.$elem.removeClass('scheduled');

            // Does list contain scheduled versions?
            if(listContainsSchedule) {
                $versionWrapper.prepend($imgClockIcon);
                if (list.data.version.status == 3) {  // Scheduled
                    list.$elem.addClass('scheduled');
                }
            }

            $versionList.html('');

            var $optionScheduledVersion = $('<li></li>', {
                class : 'future save'
            })
                .text(ArlimaJS.lang.saveFutureVersion)
                .prepend('<i class="fa fa-save">&nbsp;</i>')
                .toggleClass('disabled', !list.hasUnsavedChanges())
                .on('click', function(){
                    if ($(this).hasClass('disabled')) return false;
                    $('#arlima-schedule-modal').attr('data-list',list.data.id);
                    $.fancybox({
                        href : '#arlima-schedule-modal',
                        height: 400,
                        width: 300
                    });
                });

            $versionList.append($optionScheduledVersion);

                var $listSectionSeparator = $('<li></li>', {
                    class : 'separator'
                })
                    .text(ArlimaJS.lang.scheduledVersions);

            if(listContainsSchedule) {
                $versionList.append($listSectionSeparator);
            }

            $.each(list.data.scheduledVersions, function(i, version ) {
                var scheduleDate = new Date(version.scheduled * 1000),
                    hours = '0'+scheduleDate.getHours(),
                    minutes = '0'+scheduleDate.getMinutes();

                var $listItem = $('<li></li>')
                    .attr('data-version', version.id)
                    .addClass(version.id == loadedVersionID ? 'selected' : '')
                    .text( ArlimaJS.lang.toPublish + ' '
                        + scheduleDate.getFullYear()
                        + '-' + (scheduleDate.getMonth()+1) // Months are offset +1
                        + '-' + scheduleDate.getDate()
                        + ' ' + hours.substr(hours.length-2)
                        + ':' + minutes.substr(minutes.length-2)
                    );

                var $deleteLink = $('<a>&times;</a>')
                        .attr('href', '#')
                        .attr('class', 'delete')
                        .attr('title', ArlimaJS.lang.delete)
                        .on('click', function(e){
                            var $versionItem = $(e.target).parent(),
                            doDelete = confirm(ArlimaJS.lang.confirmDeleteVersion);
                            if(doDelete) {
                                list.deleteScheduledVersion($versionItem.attr('data-version'));
                            }
                            return false;
                        });

                $versionList.append($listItem.append($deleteLink));
            });

            var $listSectionSeparator2 = $listSectionSeparator.clone(true);
            $listSectionSeparator2.text(ArlimaJS.lang.publishedVersions);

            $versionList.append($listSectionSeparator2);

            $.each(list.data.versions, function(i, version ) {
                var $item = $('<li></li>')
                .attr('data-version', version.id)
                .addClass(version.id == loadedVersionID ? 'selected' : '')
                .text('#' + version.id + ' (' + version.saved_by + ')');
                $versionList.append($item);

                // editing scheduled state. only display latest published version
                // so that list.data.version don't have to be updated for different states
                if (list.data.version.status == 3 && i > 0) {
                    $item.addClass('disabled');
                }
            });
        }
    };

    var _toggleAjaxPreloader = function(list, toggle) {
        var $preloader = list.$elem.find('.ajax-loader');
        if( toggle ) {
            $preloader.show();
            list.$elem.find('.footer a').addClass('disabled');
        } else {
            list.$elem.find('.footer a').removeClass('disabled');
            $preloader.hide();
        }
    };

    /**
     * @param data
     * @private
     */
    var _getListHtml = function(data) {
        return '<div id="arlima-list-'+ data.id +'" data-list-id="'+ data.id +'" class="article-list">'+
            '<div class="header">' +
                '<span>'+
                    '<a href="#" class="remove">&times;</a>'+
                    '<a href="#" class="add-section">+</a>'+
                    '<span class="title"></span>'+
                    '<span class="schedule-notice notice"></span>'+
                '</span>' +
            '</div>' +
            '<div class="articles"></div>'+
            '<div class="footer">'+
                '<a href="#" class="preview" title="'+ArlimaJS.lang.preview+'">' +
                    '<i class="fa fa-eye"></i>' +
                '</a>'+
                '<a href="#" class="save" title="'+ArlimaJS.lang.publish+'">' +
                    '<i class="fa fa-save"></i>' +
                '</a>'+
                '<img src="'+ArlimaJS.pluginURL+'/images/ajax-loader-trans.gif" class="ajax-loader" />'+
                '<a href="#" class="refresh" title="'+ArlimaJS.lang.reload+'">' +
                    '<i class="fa fa-refresh"></i>' +
                '</a>'+
                '<div class="version">' +
                    '<div class="number"></div>'+
                    '<ul class="previous-versions"></ul>' +
                '</div>' +
            '</div>'+
        '</div>';
    };

    /**
     * @param {ArlimaList} list
     * @private
     */
    var _addEventListeners = function(list) {

        list.$elem.find('.refresh').click(function(evt) {
            var doReload = true;
            if( list.hasUnsavedChanges() && !ArlimaUtils.hasMetaKeyPressed(evt) ) {
                doReload = confirm(ArlimaJS.lang.hasUnsavedChanges);
            }
            if( doReload ) {
                list.reload();
            }
            return false;
        });

        list.$elem.find('.preview').click(function() {
            if( !list.data.isImported ) {
                list.preview();
            }
            return false;
        });

        list.$elem.find('.save:eq(0)').click(function(e) {
            list.save();
            return false;
        });

        list.$elem.find('.remove').click(function(evt) {
            window.ArlimaListContainer.remove(list, evt);
            return false;
        });

        list.$elem.find('.add-section').click(function() {
            var sectionDividerData = {
                        title : 'Section divider '+ (list.numSections() + 1),
                        options: {
                            sectionDivider: 1
                        }
                    };

            list.addArticle(new ArlimaArticle(sectionDividerData), true);

            // scroll to bottom
            var $articles = list.$elem.find('.articles');
            $articles.scrollTop( $articles.innerHeight() );

            return false;
        });

        // Toggle version dropdown
        if( !list.data.isImported ) {
            var $versionWrapper = list.$elem.find('.version'),
                $scheduleModalWrapper = $('#arlima-schedule-modal'),
                hasDropDownFocus = false,
                $versionDropDown = list.$elem.find('.previous-versions');


            var hideVersionDropDown = function() {
                $versionWrapper.find('.number').removeClass('active');
                $versionDropDown.hide();
            };

            $versionDropDown
                .bind('mouseenter', function() {
                    hasDropDownFocus = true;
                })
                .bind('mouseleave', function() {
                    hasDropDownFocus = false;
                    setTimeout(function() {
                        if( $versionDropDown.parent().is(':visible') && !hasDropDownFocus ) {
                            hideVersionDropDown();
                        }
                    }, 1200);
                })
                .bind('click', function(e) {
                    if( ! $(e.target).is('.future, .disabled, .schedule')) {
                        list.reload($(e.target).attr('data-version'));
                    }
                });

            // Show version drop down
            $versionWrapper.find('.number').click( function() {
                if ($(this).hasClass('active')) {
                    hideVersionDropDown();
                    return false;
                }
                $(this).addClass('active');
                $versionDropDown.show();
                hasDropDownFocus = true;
                return false;
            });

            $scheduleModalWrapper.find('button.schedule').unbind('click').click(function() {
                var ymdArray = $scheduleModalWrapper.find('#schedule-date').val().split('-'),
                    hsArray = $scheduleModalWrapper.find('#schedule-time').val().split(':'),
                    scheduleDate = new Date(),
                    affectedList = $scheduleModalWrapper.attr('data-list'),
                    nowDate = new Date();

                ymdArray = $.map(ymdArray, function(x) { return parseInt(x, 10)});
                hsArray = $.map(hsArray, function(x) { return parseInt(x, 10)});

                scheduleDate.setFullYear(ymdArray[0], (ymdArray[1]-1), ymdArray[2]);
                scheduleDate.setHours(hsArray[0]);
                scheduleDate.setMinutes(hsArray[1]);

                // Is date future?
                if(scheduleDate.getTime() > nowDate.getTime()) {
                    window.ArlimaListContainer.list(affectedList).save(scheduleDate);
                    $scheduleModalWrapper.find('.message').addClass('hidden');
                    $.fancybox.close();
                } else{
                    $scheduleModalWrapper.find('.message').removeClass('hidden');
                }
                return false;
            });
        }

    };


    return ArlimaList;

})(jQuery, window, ArlimaJS, ArlimaBackend, ArlimaUtils);
