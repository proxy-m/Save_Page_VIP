/************************************************************************/
/*                                                                      */
/*      Save Page WE - Generic WebExtension - Content Pages             */
/*                                                                      */
/*      Javascript for Saving Content Pages (all frames)                */
/*                                                                      */
/*      Last Edit - 25 Nov 2022                                         */
/*                                                                      */
/*      Copyright (C) 2016-2022 DW-dev                                  */
/*                                                                      */
/*      Distributed under the GNU General Public License version 2      */
/*      See LICENCE.txt file and http://www.gnu.org/licenses/           */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/* Refer to Google Chrome developer documentation:                      */
/*                                                                      */
/* developer.chrome.com/docs/extensions/mv3/content_scripts             */
/* developer.chrome.com/docs/extensions/mv3/messaging                   */
/*                                                                      */
/* developer.chrome.com/docs/extensions/mv3/match_patterns              */
/*                                                                      */
/* developer.chrome.com/docs/extensions/reference/runtime               */
/*                                                                      */
/************************************************************************/

/* Loaded into all iframes and frames of all content pages */

/* Shares global variable/function namespace with other content scripts */

/* Use wrapper function to separate namespace from other content scripts */

/************************************************************************/

"use strict";

frameScript();

function frameScript()
{
    /********************************************************************/

    /* Initialize on script load */

    if (document.readyState != "loading") onLoadPage();
    else
    {
        window.addEventListener("load",
        function(event)
        {
            if (document.readyState != "loading") onLoadPage();
        },false);
    }

    /********************************************************************/

    /* Initialize on page load */

    function onLoadPage()
    {
        /* Add listeners */
        
        addListeners();
    }

    /********************************************************************/

    /* Add listeners */

    function addListeners()
    {
        /* Message received listener */
        
        chrome.runtime.onMessage.addListener(
        function(message,sender,sendResponse)
        {
            var i,key,win,parentwin,dupelem,dupsheet,doctype,htmltext;
            var loadedfonts = [];
            
            switch (message.type)
            {
                /* Messages from background page */
                    
                case "requestFrames":
                    
                    identifyFrames(0,window,document.documentElement);
                    
                    key = "";
                    win = document.defaultView;
                    parentwin = win.parent;
                    
                    while (win != window.top)
                    {
                        for (i = 0; i < parentwin.frames.length; i++)
                        {
                          if (parentwin.frames[i] == win) break;
                        }
                        
                        key = "-" + i + key;
                        win = parentwin;
                        parentwin = parentwin.parent;
                    }
                    
                    key = "0" + key;
                    
                    document.fonts.forEach(  /* CSS Font Loading Module */
                    function(font)
                    {
                        if (font.status == "loaded")  /* font is being used in this document */
                        {
                            loadedfonts.push({ family: font.family, weight: font.weight, style: font.style, stretch: font.stretch });
                        }
                    });
                    
                    document.querySelectorAll("style").forEach(
                    function (element)
                    {
                        var i,csstext;
                        
                        if (!element.disabled)
                        {
                            try
                            {
                                /* Count rules in element.textContent by creating duplicate element */
                                
                                dupelem = element.ownerDocument.createElement("style");
                                dupelem.textContent = element.textContent;
                                element.ownerDocument.body.appendChild(dupelem);
                                dupsheet = dupelem.sheet;
                                dupelem.remove();
                                
                                /* There may be rules in element.sheet.cssRules that are not in element.textContent */
                                /* For example if the page uses CSS-in-JS Libraries */
                                
                                if (dupsheet.cssRules.length != element.sheet.cssRules.length)
                                {
                                    csstext = "";
                                    
                                    for (i = 0; i < element.sheet.cssRules.length; i++)
                                        csstext += element.sheet.cssRules[i].cssText + "\n";
                                    
                                    element.setAttribute("data-savepage-sheetrules",csstext);
                                }
                            }
                            catch (e) {}
                        }
                    });
                    
                    document.querySelectorAll("img").forEach(
                    function (element)
                    {
                        var datauri;
                        
                        if (element.currentSrc.substr(0,5) == "blob:")
                        {
                            datauri = createCanvasDataURL(element);
                            
                            if (datauri != "") element.setAttribute("data-savepage-blobdatauri",datauri);
                        }
                    });
                    
                    document.querySelectorAll("video").forEach(
                    function (element)
                    {
                        var datauri;
                        
                        if (!element.hasAttribute("poster") && element.currentSrc.substr(0,5) == "blob:")
                        {
                            datauri = createCanvasDataURL(element);
                            
                            if (datauri != "") element.setAttribute("data-savepage-blobdatauri",datauri);
                        }
                    });
                    
                    document.querySelectorAll("canvas").forEach(
                    function (element)
                    {
                        var datauri;
                        
                        try
                        {
                            datauri = element.toDataURL("image/png","");
                            
                            if (datauri != "") element.setAttribute("data-savepage-canvasdatauri",datauri);
                        }
                        catch (e) {}
                    });
                    
                    doctype = document.doctype;
                    
                    if (doctype != null)
                    {
                        htmltext = '<!DOCTYPE ' + doctype.name + (doctype.publicId ? ' PUBLIC "' + doctype.publicId + '"' : '') +
                                   ((doctype.systemId && !doctype.publicId) ? ' SYSTEM' : '') + (doctype.systemId ? ' "' + doctype.systemId + '"' : '') + '>';
                    }
                    else htmltext = "";
                    
                    htmltext += document.documentElement.outerHTML;
                    
                    htmltext = htmltext.replace(/<head([^>]*)>/,"<head$1><base href=\"" + document.baseURI + "\">");
                    
                    chrome.runtime.sendMessage({ type: "replyFrame", key: key, url: document.baseURI, html: htmltext, fonts: loadedfonts });
                    
                    break;
            }
        });
    }

    /********************************************************************/

    /* Identify frames */

    function identifyFrames(depth,frame,element)
    {
        var i,key,win,parentwin;
        
        /* Handle nested frames and child elements */
        
        if (element.localName == "iframe" || element.localName == "frame")  /* frame elements */
        {
            key = "";
            win = element.contentWindow;
            parentwin = win.parent;
            
            while (win != window.top)
            {
                for (i = 0; i < parentwin.frames.length; i++)
                {
                  if (parentwin.frames[i] == win) break;
                }
                
                key = "-" + i + key;
                win = parentwin;
                parentwin = parentwin.parent;
            }
            
            key = "0" + key;
            
            element.setAttribute("data-savepage-key",key);
            
            try
            {
                if (element.contentDocument.documentElement != null)  /* in case web page not fully loaded before naming */
                {
                    identifyFrames(depth+1,element.contentWindow,element.contentDocument.documentElement);
                }
            }
            catch (e)  /* attempting cross-domain web page access */
            {
            }
        }
        else
        {
            for (i = 0; i < element.children.length; i++)
                if (element.children[i] != null)  /* in case web page not fully loaded before finding */
                    identifyFrames(depth,frame,element.children[i]);
        }
    }

    /********************************************************************/

    /* Create canvas image data URL */

    function createCanvasDataURL(element)
    {
        var canvas,context;
        
        canvas = document.createElement("canvas");
        canvas.width = element.clientWidth;
        canvas.height = element.clientHeight;
        
        try
        {
            context = canvas.getContext("2d");
            context.drawImage(element,0,0,canvas.width,canvas.height);
            return canvas.toDataURL("image/png","");
        }
        catch (e) {}
        
        return "";
    }
    
    /********************************************************************/
}
