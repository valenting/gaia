/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

var ThreadListUI = {
  get view() {
    delete this.view;
    return this.view = document.getElementById('thread-list-container');
  },
  get selectAllButton() {
    delete this.selectAllButton;
    return this.selectAllButton = document.getElementById('select-all-threads');
  },
  get deselectAllButton() {
    delete this.deselectAllButton;
    return this.deselectAllButton =
                                document.getElementById('deselect-all-threads');
  },
  get deleteButton() {
    delete this.deleteButton;
    return this.deleteButton = document.getElementById('threads-delete-button');
  },
  get cancelButton() {
    delete this.cancelButton;
    return this.cancelButton = document.getElementById('threads-cancel-button');
  },
  get iconEdit() {
    delete this.iconEdit;
    return this.iconEdit = document.getElementById('icon-edit-threads');
  },
  get pageHeader() {
    delete this.pageHeader;
    return this.pageHeader = document.getElementById('list-edit-title');
  },
  get editForm() {
    delete this.editForm;
    return this.editForm = document.getElementById('threads-edit-form');
  },

  // Used to track the current number of rendered
  // threads. Updated in ThreadListUI.renderThreads
  count: 0,

  init: function thlui_init() {
    var _ = navigator.mozL10n.get;

    // TODO: https://bugzilla.mozilla.org/show_bug.cgi?id=854413
    ['threads-container', 'no-messages'].forEach(function(id) {
      this[Utils.camelCase(id)] = document.getElementById(id);
    }, this);

    this.delNumList = [];
    this.selectedInputList = [];
    this.selectAllButton.addEventListener('click',
                                          this.selectAllThreads.bind(this));
    this.deselectAllButton.addEventListener('click',
                                            this.deselectAllThreads.bind(this));
    this.deleteButton.addEventListener('click',
                                       this.executeDeletion.bind(this));
    this.cancelButton.addEventListener('click', this.cancelEditMode.bind(this));
    this.view.addEventListener('click', this);
    this.editForm.addEventListener('submit', this);
  },

  updateThreadWithContact:
    function thlui_updateThreadWithContact(number, thread) {

    Contacts.findByString(number, function gotContact(contacts) {
      // !contacts matches null results from errors
      // !contacts.length matches empty arrays from unmatches filters
      if (!contacts || !contacts.length) {
        return;
      }
      // If there is contact with the phone number requested, we
      // update the info in the thread
      var nameContainer = thread.getElementsByClassName('name')[0];
      var contact = contacts[0];

      // Update contact phone number
      var contactName = contact.name[0];
      if (contacts.length > 1) {
        // If there are more than one contact with same phone number
        var others = contacts.length - 1;
        nameContainer.textContent = navigator.mozL10n.get('others', {
          name: contactName,
          n: others
        });
      }else {
        nameContainer.textContent = contactName;
      }
      // Do we have to update photo?
      if (contact.photo && contact.photo[0]) {
        var photo = thread.getElementsByTagName('img')[0];
        var photoURL = URL.createObjectURL(contact.photo[0]);
        photo.src = photoURL;
      }
    });
  },

  handleEvent: function thlui_handleEvent(evt) {
    switch (evt.type) {
      case 'click':
        // Duck type determination; if the click event occurred on
        // a target with a |type| property, then assume it could've
        // been a checkbox and proceed w/ validation condition
        if (evt.target.type && evt.target.type === 'checkbox') {
          ThreadListUI.clickInput(evt.target);
          ThreadListUI.checkInputs();
        }
        break;
      case 'submit':
        evt.preventDefault();
        break;
    }
  },

  clickInput: function thlui_clickInput(target) {
    if (target.checked) {
      ThreadListUI.selectedInputList.push(target);
    } else {
      ThreadListUI.selectedInputList.splice(
        ThreadListUI.selectedInputList.indexOf(target), 1);
    }
  },

  checkInputs: function thlui_checkInputs() {
    var _ = navigator.mozL10n.get;
    var selected = ThreadListUI.selectedInputList.length;

    if (selected === ThreadListUI.count) {
      ThreadListUI.selectAllButton.classList.add('disabled');
    } else {
      ThreadListUI.selectAllButton.classList.remove('disabled');
    }
    if (selected) {
      ThreadListUI.deselectAllButton.classList.remove('disabled');
      ThreadListUI.deleteButton.classList.remove('disabled');
      this.pageHeader.innerHTML = _('selected', {n: selected});
    } else {
      ThreadListUI.deselectAllButton.classList.add('disabled');
      ThreadListUI.deleteButton.classList.add('disabled');
      this.pageHeader.innerHTML = _('editMode');
    }
  },

  cleanForm: function thlui_cleanForm() {
    var inputs = this.view.querySelectorAll(
      'input[type="checkbox"]'
    );
    var length = inputs.length;
    for (var i = 0; i < length; i++) {
      inputs[i].checked = false;
      inputs[i].parentNode.parentNode.classList.remove('undo-candidate');
    }
    this.delNumList = [];
    this.selectedInputList = [];
    this.pageHeader.textContent = navigator.mozL10n.get('editMode');
    this.checkInputs();
  },

  selectAllThreads: function thlui_selectAllThreads() {
    var inputs = this.view.querySelectorAll(
      'input[type="checkbox"]:not(:checked)'
    );
    var length = inputs.length;
    for (var i = 0; i < length; i++) {
      inputs[i].checked = true;
      ThreadListUI.clickInput(inputs[i]);
    }
    ThreadListUI.checkInputs();
  },

  deselectAllThreads: function thlui_deselectAllThreads() {
    var inputs = this.view.querySelectorAll(
      'input[type="checkbox"]:checked'
    );
    var length = inputs.length;
    for (var i = 0; i < length; i++) {
      inputs[i].checked = false;
      ThreadListUI.clickInput(inputs[i]);
    }
    ThreadListUI.checkInputs();
  },

  executeDeletion: function thlui_executeDeletion() {
    var question = navigator.mozL10n.get('deleteThreads-confirmation2');
    if (confirm(question)) {
      WaitingScreen.show();
      var inputs = ThreadListUI.selectedInputList;
      var nums = inputs.map(function(input) {
        return input.value;
      });

      var filter = new MozSmsFilter();
      filter.numbers = nums;
      var messagesToDeleteIDs = [];
      var options = {
        stepCB: function getMessageToDelete(message) {
          messagesToDeleteIDs.push(message.id);
        },
        filter: filter,
        invert: true,
        endCB: function deleteMessages() {
          MessageManager.deleteMessages(messagesToDeleteIDs,
            function smsDeleted() {
            MessageManager.getThreads(function recoverThreads(threads) {
              ThreadListUI.editDone = true;
              window.location.hash = '#thread-list';
            });
          });
        }
      };
      MessageManager.getMessages(options);
    }
  },

  cancelEditMode: function thlui_cancelEditMode() {
    window.location.hash = '#thread-list';
  },

  renderThreads: function thlui_renderThreads(threads, renderCallback) {
    // TODO: https://bugzilla.mozilla.org/show_bug.cgi?id=854417
    // Refactor the rendering method: do not empty the entire
    // list on every render.
    ThreadListUI.view.innerHTML = '';
    ThreadListUI.count = threads.length;

    if (threads.length) {
      // There are messages to display.
      //  1. Add the "hide" class to the no-messages display
      //  2. Remove the "hide" class from the view
      //
      ThreadListUI.noMessages.classList.add('hide');
      ThreadListUI.view.classList.remove('hide');
      ThreadListUI.iconEdit.classList.remove('disabled');

      FixedHeader.init('#thread-list-container',
                       '#threads-container',
                       'header');
      // Edit mode available

      var appendThreads = function(threads, callback) {
        if (!threads.length) {
          // Refresh fixed header logic
          FixedHeader.refresh();

          if (callback) {
            callback();
          }
          return;
        }
        var thread = threads.pop();
        setTimeout(function() {
          ThreadListUI.appendThread(thread);
          appendThreads(threads, callback);
        });
      };

      appendThreads(threads, function at_callback() {
        // Boot update of headers
        Utils.updateTimeHeaders();
        // Once the rendering it's done, callback if needed
        if (renderCallback) {
          renderCallback();
        }
      });
    } else {
      // There are no messages to display.
      //  1. Remove the "hide" class from no-messages display
      //  2. Add the "hide" class to the view
      //
      ThreadListUI.noMessages.classList.remove('hide');
      ThreadListUI.view.classList.add('hide');
      ThreadListUI.iconEdit.classList.add('disabled');

      // Callback if exist
      if (renderCallback) {
        setTimeout(function executeCB() {
          renderCallback();
        });
      }
    }
  },

  createThread: function thlui_createThread(thread) {
    // Create DOM element
    var num = thread.senderOrReceiver;
    var timestamp = thread.timestamp.getTime();
    var threadDOM = document.createElement('li');
    threadDOM.id = 'thread_' + num;
    threadDOM.dataset.time = timestamp;

    // Retrieving params from thread
    var bodyText = (thread.body || '').split('\n')[0];
    var bodyHTML = Utils.escapeHTML(bodyText);
    var formattedDate = Utils.getFormattedHour(timestamp);
    // Create HTML Structure
    var structureHTML = '<label class="danger">' +
                          '<input type="checkbox" value="' + num + '">' +
                          '<span></span>' +
                        '</label>' +
                        '<a href="#num=' + num +
                          '" class="' +
                          (thread.unreadCount > 0 ? 'unread' : '') + '">' +
                          '<aside class="icon icon-unread">unread</aside>' +
                          '<aside class="pack-end">' +
                            '<img src="">' +
                          '</aside>' +
                          '<p class="name">' + num + '</p>' +
                          '<p><time>' + formattedDate +
                          '</time>' + bodyHTML + '</p>' +
                        '</a>';

    // Update HTML
    threadDOM.innerHTML = structureHTML;

    return threadDOM;
  },
  insertThreadContainer:
    function thlui_insertThreadContainer(fragment, timestamp) {
    // We look for placing the group in the right place.
    var headers = ThreadListUI.view.getElementsByTagName('header');
    var groupFound = false;
    for (var i = 0; i < headers.length; i++) {
      if (timestamp >= headers[i].dataset.time) {
        groupFound = true;
        ThreadListUI.view.insertBefore(fragment, headers[i]);
        break;
      }
    }
    if (!groupFound) {
      ThreadListUI.view.appendChild(fragment);
    }
  },
  appendThread: function thlui_appendThread(thread) {
    var num = thread.senderOrReceiver;
    var timestamp = thread.timestamp.getTime();
    // We create the DOM element of the thread
    var threadDOM = this.createThread(thread);
    // Update info given a number
    ThreadListUI.updateThreadWithContact(num, threadDOM);

    // Is there any container already?
    var threadsContainerID = 'threadsContainer_' +
                              Utils.getDayDate(thread.timestamp);
    var threadsContainer = document.getElementById(threadsContainerID);
    // If there is no container we create & insert it to the DOM
    if (!threadsContainer) {
      // We create the fragment with groul 'header' & 'ul'
      var threadsContainerFragment =
        ThreadListUI.createThreadContainer(timestamp);
      // Update threadsContainer with the new value
      threadsContainer = threadsContainerFragment.childNodes[1];
      // Place our new fragment in the DOM
      ThreadListUI.insertThreadContainer(threadsContainerFragment, timestamp);
    }

    // Where have I to place the new thread?
    var threads = threadsContainer.getElementsByTagName('li');
    var threadFound = false;
    for (var i = 0, l = threads.length; i < l; i++) {
      if (timestamp > threads[i].dataset.time) {
        threadFound = true;
        threadsContainer.insertBefore(threadDOM, threads[i]);
        break;
      }
    }
    if (!threadFound) {
      threadsContainer.appendChild(threadDOM);
    }
  },
  // Adds a new grouping header if necessary (today, tomorrow, ...)
  createThreadContainer: function thlui_createThreadContainer(timestamp) {
    var threadContainer = document.createDocumentFragment();
    // Create Header DOM Element
    var headerDOM = document.createElement('header');
    // Append 'time-update' state
    headerDOM.dataset.timeUpdate = true;
    headerDOM.dataset.time = timestamp;
    headerDOM.dataset.isThread = true;

    // Create UL DOM Element
    var threadsContainerDOM = document.createElement('ul');
    threadsContainerDOM.id = 'threadsContainer_' +
                              Utils.getDayDate(timestamp);
    // Add text
    headerDOM.innerHTML = Utils.getHeaderDate(timestamp);

    // Add to DOM all elements
    threadContainer.appendChild(headerDOM);
    threadContainer.appendChild(threadsContainerDOM);
    return threadContainer;
  },
  // Method for updating all contact info after creating a contact
  updateContactsInfo: function mm_updateContactsInfo() {
    // Retrieve all 'li' elements and getting the phone numbers
    var threads = ThreadListUI.view.getElementsByTagName('li');
    for (var i = 0; i < threads.length; i++) {
      var thread = threads[i];
      var num = thread.id.replace('thread_', '');
      // Update info of the contact given a number
      ThreadListUI.updateThreadWithContact(num, thread);
    }
  }
};
