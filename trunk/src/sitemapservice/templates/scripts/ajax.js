// Copyright 2007 Google Inc.
// All Rights Reserved.

/**
 * @fileoverview file for Ajax utility functions.
 * @author chaiying@google.com (Ying Chai)
 */

/////////////////////////////AjaxUtil_requester///////////////////////////

/**
 * The requester object organizes the parameters of the request to the server.
 * @constructor
 */
function AjaxUtil_requester() {
  /**
   * @type {String?} url the url of post target
   */
  this.url = null;
  /**
   * @type {String?} type the content-type of http request header
   */
  this.type = null;
  /**
   * @type {Object?} content the content to post
   */
  this.content = null;
  /**
   * @type {Number?}
   */
  this.timeout = null;
  /**
   * @type {Boolean?}
   */
  this.wait = null;
}

/////////////////////////////AjaxUtil_responser///////////////////////////

/**
 * The responser object deals with the response message from the server.
 * It also store the session information, such as the XMLHttpRequest object and
 * the AjaxUtil_requester object of this session.
 * @constructor
 * @param {AjaxUtil_requester} requester  The request object
 */
function AjaxUtil_responser(requester) {
  /**
   * Keeps the reference to the request parameters set.
   * @type {AjaxUtil_requester}
   */
  this.requester = requester;

  /**
   * This is a reference to the XMLHttpRequest object that does the
   * communication.
   *
   * It will be initialized in AjaxUtil.accessServer, and be used in
   * AjaxUtil.getResponseContent.
   *
   * @type {XMLHttpRequest?}
   */
  this.xhr = null;

  /**
   * Call back function when time for waiting server response is out of the
   * limit.
   * @type {Function?}
   */
  this.onTimeout = null;

  /**
   * @type {Function?}
   */
  this.onResponseSuccess = null;
  /**
   * @type {Function?}
   */
  this.onResponseFail = null;
  /**
   * @type {Function?}
   */
  this.onResponse = null;
  /**
   * @type {Function?}
   */
  this.onProgress = null;
}

/////////////////////////////AjaxUtil///////////////////////////

/**
 * This class is for the functionality of http communication.
 *
 * Since using the same XmlHttpRequest object among asyncronized server
 * communications is dangerous, we will create a new XmlHttpRequest object each
 * time a communication function is called.
 * @constructor
 */
function AjaxUtil() {
}

/**
 * Gets Ajax object.
 * @return {XMLHttpRequest?} The Ajax object
 * @supported IE and Firefox
 */
AjaxUtil.getRequestObject = function() {
  var xhr = null;
  if (window.XMLHttpRequest) {
    xhr = new XMLHttpRequest();
  } else {
    if (window.ActiveXObject) {
      try {
        xhr = new ActiveXObject('Microsoft.XMLHTTP');
      } catch (e) {
      }
    }
  }
  if (!xhr) {
    Util.console.error('Fail to create an XMLHttpRequest');
  }
  return xhr;
};

/**
 * Retreives the xml file and parses it to DOM.
 * @param {String} filename  The xml file name
 * @return {Document} The XML document
 * @supported IE only
 */
AjaxUtil.loadXml = function(filename) {
  var xmlDoc = XmlManager.createNewXmlDocument();

  /**
   * @type {String}
   */
  xmlDoc.async = 'false';
  xmlDoc.load(filename);
  return xmlDoc;
};

/**
 * Parses response content and return suitable format.
 * @param {AjaxUtil_responser} responser  The response object
 * @return {Document|String|Boolean|Number|Object} The return value will be
 *     different according to the 'Content-Type' response header.
 */
AjaxUtil.getResponseContent = function(responser) {
  // even if responser.xhr.status != 200, server may also send some error msg.
  // so we have to parse the response content.
  if (!responser.xhr || responser.xhr.readyState != 4) {
    return null;
  }

  // Check the content type returned by the server
  switch (responser.xhr.getResponseHeader('Content-Type')) {
    case 'text/xml':
      // If it is an XML document, use the parsed Document object.
      return responser.xhr.responseXML;

    case 'text/json':
    case 'text/javascript':
    case 'application/javascript':
    case 'application/x-javascript':
      // If the response is JavaScript code, or a JSON-encoded value,
      // call eval() on the text to 'parse' it to a JavaScript value.
      // Note: only do this if the JavaScript code is from a trusted server!
      return eval(responser.xhr.responseText);

    default:
      // Otherwise, treat the response as plain text and return as a string.
      return responser.xhr.responseText;
  }
};

/**
 * Sends the 'GET' request to http server.
 * @param {AjaxUtil_requester} requester  The request object
 * @param {AjaxUtil_responser} responser  The response object
 */
AjaxUtil.makeRequest = function(requester, responser) {
  requester.httpmethod = 'GET';
  AjaxUtil.accessServer(requester, responser);
};

/**
 * Sends the 'POST' request to http server.
 * @param {AjaxUtil_requester} requester  The request object
 * @param {AjaxUtil_responser} responser  The response object
 */
AjaxUtil.postContent = function(requester, responser) {
  requester.httpmethod = 'POST';
  AjaxUtil.accessServer(requester, responser);
};

/**
 * This function communicates to server by http protocal. It can support
 * 'GET'/'POST' methods, sync/async functionality, time out functionality, and
 * progress steps callback.
 * @param {AjaxUtil_requester} requester  The request object
 * @param {AjaxUtil_responser} responser  The response object
 */
AjaxUtil.accessServer = function(requester, responser) {
  // send GET request to get xml document
  var xhr = AjaxUtil.getRequestObject();
  if (xhr) {
    // default value
    if (requester.wait == null)
      requester.wait = false;

    responser.xhr = xhr;

    // set timeout
    var waitTimer = null;
    if (requester.timeout) {
      waitTimer = setTimeout(function(){
        xhr.abort();
        if (responser.onTimeout) {
          responser.onTimeout();
        }
      }, requester.timeout);
    }

    // response function
    var onResponse = function() {
      if (xhr.status == 200) {
        // We got the server's response. Display the response text.
        if (responser.onResponseSuccess) {
          responser.onResponseSuccess();
        }
      } else {
        // Something went wrong. Display error code and error message.
        if (responser.onResponseFail)
          responser.onResponseFail();
      }
      if (responser.onResponse)
        responser.onResponse();
    };

    // Set asyncronized response
    if (!requester.wait) {
      var progressStep = 0;
      xhr.onreadystatechange = function(){
        if (xhr.readyState == 4) {
          if (waitTimer != null)
            clearTimeout(waitTimer);
          onResponse();
        } else if (responser.onProgress) {
          responser.onProgress(++progressStep);
        }
      };
    }

    // send request, may cause exception if remote server is down
    if (requester.httpmethod.toUpperCase() == 'GET') {
      xhr.open('GET', requester.url, !requester.wait);
      AjaxUtil.send(xhr, null);
    } else if (requester.httpmethod.toUpperCase() == 'POST') {
      // send request
      xhr.open('POST', requester.url, !requester.wait);
      if (requester.type != null)
        xhr.setRequestHeader('Content-Type', requester.type);

      if (requester.content == null)
        AjaxUtil.send(xhr, '');
      else
        AjaxUtil.send(xhr, AjaxUtil.encodeFormData(requester.content));
    }

    // Do syncronized response
    if (requester.wait) {
      onResponse();
    }
  }
};

/**
 * Sends content to server.
 * @param {Object} xhr  The Ajax object
 * @param {Object} post  The post content
 */
AjaxUtil.send = function(xhr, post) {
  try {
    xhr.send(post);
  } catch (e) {
    Util.console.error(SERVER_NOT_REACHABLE);
  }
};

/**
 * Encodes the property name/value pairs of an object as if they were from
 * an HTML form, using application/x-www-form-urlencoded format
 *
 * Copy from JavaScript - The Definitive Guide, 5th Edition
 *
 * @param {Object} data  The data object
 *
 */
AjaxUtil.encodeFormData = function(data){
  var pairs = [];
  var regexp = /%20/g; // A regular expression to match an encoded space
  for (var name in data) {
    var value = data[name].toString();
    // Create a name/value pair, but encode name and value first
    // The global function encodeURIComponent does almost what we want,
    // but it encodes spaces as %20 instead of as '+'. We have to
    // fix that with String.replace()
    var pair = encodeURIComponent(name).replace(regexp, '+') + '=' +
    encodeURIComponent(value).replace(regexp, '+');
    pairs.push(pair);
  }

  // Concatenate all the name/value pairs, separating them with &
  return pairs.join('&');
};
