/*
 * Copyright (c) 2015 Memorial Sloan-Kettering Cancer Center.
 *
 * This library is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY, WITHOUT EVEN THE IMPLIED WARRANTY OF MERCHANTABILITY OR FITNESS
 * FOR A PARTICULAR PURPOSE. The software and documentation provided hereunder
 * is on an "as is" basis, and Memorial Sloan-Kettering Cancer Center has no
 * obligations to provide maintenance, support, updates, enhancements or
 * modifications. In no event shall Memorial Sloan-Kettering Cancer Center be
 * liable to any party for direct, indirect, special, incidental or
 * consequential damages, including lost profits, arising out of the use of this
 * software and its documentation, even if Memorial Sloan-Kettering Cancer
 * Center has been advised of the possibility of such damage.
 */

/*
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var Mutation3dVisInfoView = require("../view/Mutation3dVisInfoView");
var MutationDetailsEvents = require("../controller/MutationDetailsEvents");
var PdbDataUtil = require("../util/PdbDataUtil");
var BackboneTemplateCache = require("../util/BackboneTemplateCache");

var cbio = {
	download: require("../util/download-util")
};

var loaderImage = require("../../images/ajax-loader.gif");
var helpImage = require("../../images/help.png");

var Backbone = require("backbone");
var _ = require("underscore");
var $ = require("jquery");
var jQuery = $;
require("jquery-ui/draggable");
require("jquery-ui/resizable");
require("qtip2");
require("qtip2/dist/jquery.qtip.css");

/**
 * Actual 3D Visualizer view. This view is designed to contain the 3D
 * structure visualizer app and its control buttons.
 *
 * options: {el: [target container],
 *           mut3dVis: reference to the Mutation3dVis instance,
 *           pdbProxy: PDB data proxy,
 *           mutationProxy: mutation data proxy
 *          }
 *
 * @author Selcuk Onur Sumer
 */
var Mutation3dVisView = Backbone.View.extend({
	initialize : function (options) {
		var defaultOpts = {
			config: {
				loaderImage: loaderImage,
				helpImage: helpImage,
				border: {
					top: 0,
					left: 0
				}
			}
		};

		this.options = jQuery.extend(true, {}, defaultOpts, options);

		// custom event dispatcher
		this.dispatcher = {};
		_.extend(this.dispatcher, Backbone.Events);
	},
	render: function()
	{
		var self = this;

		// compile the template using underscore
		var templateFn = BackboneTemplateCache.getTemplateFn("mutation_3d_vis_template");

		var template = templateFn({
			loaderImage: self.options.config.loaderImage,
			helpImage: self.options.config.helpImage
		});

		// load the compiled HTML into the Backbone "el"
		self.$el.html(template);

		// format after rendering
		self.format();
	},
	format: function()
	{
		var self = this;
		var mut3dVis = self.options.mut3dVis;

		var container3d = self.$el;

		// initially hide the residue warning message
		self.hideResidueWarning();
		self.hideNoMapWarning();

		// initially hide the help content
		var helpContent = self.$el.find(".mutation-3d-vis-help-content");

		// TODO use the self.options.viewer object to determine which content to display!
		var helpTemplateFn = BackboneTemplateCache.getTemplateFn("3Dmol_basic_interaction");
		helpContent.html(helpTemplateFn({}));
		helpContent.hide();

		// update the container of 3d visualizer
		if (mut3dVis != null)
		{
			mut3dVis.updateContainer(container3d);
			mut3dVis.show();
		}

		// add listeners to panel (header) buttons

		self.$el.find(".mutation-3d-close").click(function() {
			self.hideView();
		});

		self.$el.find(".mutation-3d-minimize").click(function(){
			if (mut3dVis != null)
			{
				mut3dVis.toggleSize();
			}
		});

		// format toolbar elements

		// mutation style controls
		self._initMutationControls();

		// protein style controls
		self._initProteinControls();

		// zoom slider
		//self._initZoomSlider();

		// init buttons
		self._initButtons();

		self.showMainLoader();

		// make the main container draggable
		container3d.draggable({
			handle: ".mutation-3d-info-title",
//			start: function(event, ui) {
//				// fix the width to prevent resize during drag
//				var width = container3d.css("width");
//				container3d.css("width", width);
//			},
			stop: function(event, ui) {
				var top = parseInt(container3d.css("top"));
				var left = parseInt(container3d.css("left"));
				//var width = parseInt(container3d.css("width"));

				// if the panel goes beyond the visible area, get it back!

				if (top < parseInt(self.options.config.border.top))
				{
					container3d.css("top", self.options.config.border.top);
				}

				//if (left < -width)
				if (left < parseInt(self.options.config.border.left))
				{
					container3d.css("left", self.options.config.border.left);
				}

				// TODO user can still take the panel out by dragging it to the bottom or right
			}
		});

		//TODO something like this might be safer for "alsoResize" option:
		// container3d.find(".mutation-3d-vis-container,.mutation-3d-vis-container div:eq(0)")

		// make the container resizable
		container3d.resizable({
			alsoResize: ".mutation-3d-vis-container,.mutation-3d-vis-container div:eq(0)",
			//alsoResize: ".mutation-3d-vis-container",
			handles: "sw, s, w",
			minWidth: 400,
			minHeight: 300,
			start: function(event, ui) {
				// a workaround to properly redraw the 3d-info area
				container3d.find(".mutation-3d-vis-help-content").css("width", "auto");

				// a workaround to prevent position to be set to absolute
				container3d.css("position", "fixed");
			},
			stop: function(event, ui) {
				// a workaround to properly redraw the 3d-info area
				container3d.css("height", "auto");

				// a workaround to prevent position to be set to absolute
				container3d.css("position", "fixed");
			},
			resize: function(event, ui) {
				// this is to prevent window resize event to trigger
				event.stopPropagation();

				// resize (redraw) the 3D viewer
				// (since we don't propagate resize event up to window anymore)
				mut3dVis.resizeViewer();
			}
		})
		.on('resize', function(event) {
			// this is to prevent window resize event to trigger
			event.stopPropagation();
		});
	},
	/**
	 * Initializes the control buttons.
	 */
	_initButtons: function()
	{
		var self = this;
		var mut3dVis = self.options.mut3dVis;

		// init help text controls

		var helpContent = self.$el.find(".mutation-3d-vis-help-content");
		var helpInit = self.$el.find(".mutation-3d-vis-help-init");
		var helpInitLink = self.$el.find(".mutation-3d-vis-help-open");
		var helpClose = self.$el.find(".mutation-3d-vis-help-close");
		var pymolDownload = self.$el.find(".mutation-3d-pymol-dload");

		// add listener to help link
		helpInitLink.click(function(event) {
			event.preventDefault();
			helpContent.slideToggle();
			helpInit.slideToggle();
		});

		// add listener to help close button
		helpClose.click(function(event) {
			event.preventDefault();
			helpContent.slideToggle();
			helpInit.slideToggle();
		});

		// add listener to download link
		pymolDownload.click(function(event) {
			event.preventDefault();

			var script = mut3dVis.generatePymolScript();
			var filename = self.$el.find(".mutation-3d-pdb-id").text().trim() + "_" +
			               self.$el.find(".mutation-3d-chain-id").text().trim() + ".pml";

			var downloadOpts = {
				filename: filename,
				contentType: "text/plain;charset=utf-8",
				preProcess: false};

			// send download request with filename & file content info
			cbio.download.initDownload(script, downloadOpts);
		});

		pymolDownload.qtip(self._generateTooltipOpts("Download PyMOL script"));
	},
	/**
	 * Initializes the mutation style options UI and
	 * the corresponding event handlers.
	 */
	_initMutationControls: function()
	{
		var self = this;
		var mut3dVis = self.options.mut3dVis;

		var sideChain = self.$el.find(".mutation-3d-side-chain-select");

		// handler for side chain checkbox
		sideChain.change(function() {
			//var display = sideChain.is(":checked");
			var selected = $(this).val();

			if (mut3dVis)
			{
				// update flag
				mut3dVis.updateOptions({displaySideChain: selected});
				mut3dVis.reapplyStyle();
			}
		});

		var colorMenu = self.$el.find(".mutation-3d-mutation-color-select");

		colorMenu.change(function() {
			var selected = $(this).val();

			if (mut3dVis)
			{
				// update color options
				mut3dVis.updateOptions({colorMutations: selected});
				// refresh view with new options
				mut3dVis.reapplyStyle();
			}
		});

		// add info tooltip for the color and side chain checkboxes
		self._initMutationColorInfo();
		self._initSideChainInfo();
	},
	/**
	 * Initializes the protein style options UI and
	 * the corresponding event handlers.
	 */
	_initProteinControls: function()
	{
		var self = this;
		var mut3dVis = self.options.mut3dVis;

		var displayNonProtein = self.$el.find(".mutation-3d-display-non-protein");

		// handler for hide non protein checkbox
		displayNonProtein.change(function() {
			var display = displayNonProtein.is(":checked");

			if (mut3dVis)
			{
				// update flag
				mut3dVis.updateOptions({restrictProtein: !display});
				// refresh view with new options
				mut3dVis.reapplyStyle();
			}
		});

		// add info tooltip for the checkbox
		self._initHideNonProteinInfo();

		// protein scheme selector
		self._initProteinSchemeSelector();

		// protein color selector
		self._initProteinColorSelector();
	},
	/**
	 * Initializes the protein color selector drop-down menu
	 * with its default action handler.
	 */
	_initProteinColorSelector: function()
	{
		var self = this;
		var colorMenu = self.$el.find(".mutation-3d-protein-color-select");
		var mut3dVis = self.options.mut3dVis;

		colorMenu.change(function() {
			var selected = $(this).val();

			// update color options
			mut3dVis.updateOptions({colorProteins: selected});

			// refresh view with new options
			mut3dVis.reapplyStyle();
		});
	},
	/**
	 * Initializes the protein scheme selector dropdown menu
	 * with its default action handler.
	 */
	_initProteinSchemeSelector: function()
	{
		var self = this;

		var mut3dVis = self.options.mut3dVis;

		// selection menus
		var styleMenu = self.$el.find(".mutation-3d-protein-style-select");
		var colorMenu = self.$el.find(".mutation-3d-protein-color-select");

		// TODO chosen is somehow problematic...
		//styleMenu.chosen({width: 120, disable_search: true});

		// add info tooltip for the color selector
		self._initProteinColorInfo();

		// bind the change event listener
		styleMenu.change(function() {

			var selectedScheme = $(this).val();
			var selectedColor = false;

			// re-enable every color selection for protein
			colorMenu.find("option").removeAttr("disabled");

			var toDisable = [];

			// find the option to disable
			if (selectedScheme == "spaceFilling")
			{
				// disable color by secondary structure option
				toDisable.push(colorMenu.find("option[value='bySecondaryStructure']"));
				toDisable.push(colorMenu.find("option[value='byChain']"));
			}
			else
			{
				// disable color by atom type option
				toDisable.push(colorMenu.find("option[value='byAtomType']"));
			}

			_.each(toDisable, function(ele, idx) {
				// if the option to disable is currently selected, select the default option
				if (ele.is(":selected"))
				{
					ele.removeAttr("selected");
					colorMenu.find("option[value='uniform']").attr("selected", "selected");
					selectedColor = "uniform";
				}

				ele.attr("disabled", "disabled");
			});

			if (mut3dVis)
			{
				var opts = {};

				opts.proteinScheme = selectedScheme;

				if (selectedColor)
				{
					opts.colorProteins = selectedColor;
				}

				mut3dVis.updateOptions(opts);

				// reapply view with new settings
				//mut3dVis.changeStyle(selectedScheme);
				mut3dVis.reapplyStyle();
			}
		});
	},
	/**
	 * Updates the 3D visualizer content for the given gene,
	 * pdb id, and chain.
	 *
	 * @param geneSymbol    hugo gene symbol
	 * @param pdbId         pdb id
	 * @param chain         PdbChainModel instance
	 */
	updateView: function(geneSymbol, pdbId, chain)
	{
		var self = this;
		var mut3dVis = self.options.mut3dVis;
		var pdbProxy = self.options.pdbProxy;

		var mapCallback = function(positionMap) {
			// update position map of the chain
			chain.positionMap = positionMap;

			// reload the selected pdb and chain data
			self.refreshView(pdbId, chain);

			// store pdb id and chain for future reference
			self.pdbId = pdbId;
			self.chain = chain;
		};

		var infoCallback = function(pdbInfo) {
			var model = {pdbId: pdbId,
				chainId: chain.chainId,
				pdbInfo: "",
				molInfo: ""};

			if (pdbInfo && pdbInfo[pdbId])
			{
				var summary = PdbDataUtil.generatePdbInfoSummary(
					pdbInfo[pdbId], chain.chainId);

				model.pdbInfo = summary.title;
				model.molInfo = summary.molecule;
			}

			self.hideMainLoader();

			// init info view
			var infoView = new Mutation3dVisInfoView(
				{el: self.$el.find(".mutation-3d-info"), model: model});
			infoView.render();

			// update positionMap for the chain
			// (retrieve data only once)
			pdbProxy.getPositionMap(geneSymbol, chain, mapCallback);
		};

		self.showMainLoader();
		mut3dVis.show();
		pdbProxy.getPdbInfo(pdbId, infoCallback);
	},
	/**
	 * Refreshes (reloads) the 3D visualizer for the given
	 * pdb id and chain.
	 *
	 * If no pdb id and chain provided, then reloads with
	 * the last known pdb id and chain.
	 *
	 * @param pdbId     pdb id
	 * @param chain     PdbChainModel instance
	 */
	refreshView: function(pdbId, chain)
	{
		var self = this;
		var mut3dVis = self.options.mut3dVis;

		// hide warning messages
		self.hideResidueWarning();
		self.hideNoMapWarning();

		// helper function to show/hide mapping information
		var showMapInfo = function(mapped)
		{
			if (mapped.length == 0)
			{
				// show the warning text
				self.showNoMapWarning();
			}
			else
			{
				// TODO display exactly what is mapped?
//				var proxy = self.options.mutationProxy;
//				var types = [];
//
//				_.each(mapped, function(id, idx) {
//					var mutation = proxy.getMutationUtil().getMutationIdMap()[id];
//					types.push(mutation.mutationType);
//				});
//
//				types = _.unique(types);

				// hide the warning text
				self.hideNoMapWarning();
			}
		};

		// do not reload (just refresh) if no pdb id or chain is provided,
		// or the provided chain and the previous chain are the same
		if ((pdbId == null && chain == null) ||
		    (pdbId == self.pdbId && chain == self.chain))
		{
			// just refresh
			var mapped = mut3dVis.refresh();

			// update mapping info
			showMapInfo(mapped);

			// trigger corresponding event
			self.dispatcher.trigger(
				MutationDetailsEvents.VIEW_3D_STRUCTURE_RELOADED);
		}
		// reload the new pdb structure
		else
		{
			// show loader image
			self.showLoader();

			// set a short delay to allow loader image to appear
			setTimeout(function() {
				// reload the visualizer
				var mapped = mut3dVis.reload(pdbId, chain, function() {
					// hide the loader image after reload complete
					self.hideLoader();
					// trigger corresponding event
					self.dispatcher.trigger(
						MutationDetailsEvents.VIEW_3D_STRUCTURE_RELOADED);
				});
				// update mapping info if necessary
				showMapInfo(mapped);
			}, 50);
		}
	},
	/**
	 * Initializes the mutation color information as a tooltip
	 * for the corresponding checkbox.
	 */
	_initMutationColorInfo: function()
	{
		var self = this;

		var info = self.$el.find(".mutation-type-color-help");

		var templateFn = BackboneTemplateCache.getTemplateFn("mutation_3d_type_color_tip_template");
		var content = templateFn({});
		var options = self._generateTooltipOpts(content);

		// make it wider
		options.style.classes += " qtip-wide";

		info.qtip(options);
	},
	/**
	 * Initializes the protein structure color information as a tooltip
	 * for the corresponding selection menu.
	 */
	_initProteinColorInfo: function()
	{
		var self = this;

		var info = self.$el.find(".protein-struct-color-help");

		var templateFn = BackboneTemplateCache.getTemplateFn("mutation_3d_structure_color_tip_template");
		var content = templateFn({});
		var options = self._generateTooltipOpts(content);

		// make it wider
		options.style.classes += " qtip-wide";

		info.qtip(options);
	},
	/**
	 * Initializes the side chain information as a tooltip
	 * for the corresponding checkbox.
	 */
	_initSideChainInfo: function()
	{
		var self = this;

		var info = self.$el.find(".display-side-chain-help");

		var templateFn = BackboneTemplateCache.getTemplateFn("mutation_3d_side_chain_tip_template");
		var content = templateFn({});

		var options = self._generateTooltipOpts(content);
		info.qtip(options);
	},
	/**
	 * Initializes the side chain information as a tooltip
	 * for the corresponding checkbox.
	 */
	_initHideNonProteinInfo: function()
	{
		var self = this;

		var info = self.$el.find(".display-non-protein-help");

		var templateFn = BackboneTemplateCache.getTemplateFn("mutation_3d_non_protein_tip_template");
		var content = templateFn({});

		var options = self._generateTooltipOpts(content);
		info.qtip(options);
	},
	/**
	 * Generates the default tooltip (qTip) options for the given
	 * tooltip content.
	 *
	 * @param content  actual tooltip content
	 * @return {Object}    qTip options for the given content
	 */
	_generateTooltipOpts: function(content)
	{
		return {content: {text: content},
			hide: {fixed: true, delay: 100, event: 'mouseout'},
			show: {event: 'mouseover'},
			style: {classes: 'qtip-light qtip-rounded qtip-shadow'},
			position: {my:'top right', at:'bottom center', viewport: $(window)}};
	},
	/**
	 * Minimizes the 3D visualizer panel.
	 */
	minimizeView: function()
	{
		var self = this;
		var mut3dVis = self.options.mut3dVis;

		if (mut3dVis)
		{
			mut3dVis.minimize();
		}
	},
	/**
	 * Restores the 3D visualizer panel to its full size.
	 */
	maximizeView: function()
	{
		var self = this;
		var mut3dVis = self.options.mut3dVis;

		if (mut3dVis)
		{
			mut3dVis.maximize();
		}
	},
	/**
	 * Resets the position of the 3D panel to its initial state.
	 */
	resetPanelPosition: function()
	{
		var self = this;
		var container3d = self.$el;

		container3d.css({"left": "", position: "", "top": self.options.config.border.top});
	},
	/**
	 * Hides the 3D visualizer panel.
	 */
	hideView: function()
	{
		var self = this;
		var mut3dVis = self.options.mut3dVis;

		// hide the vis pane
		if (mut3dVis != null)
		{
			mut3dVis.hide();
		}

		// trigger corresponding event
		self.dispatcher.trigger(
			MutationDetailsEvents.VIEW_3D_PANEL_CLOSED);
	},
	/**
	 * Shows the 3D visualizer panel.
	 */
	showView: function()
	{
		var self = this;
		var mut3dVis = self.options.mut3dVis;

		// hide the vis pane
		if (mut3dVis != null)
		{
			mut3dVis.show();
		}
	},
	isVisible: function()
	{
		var self = this;
		var mut3dVis = self.options.mut3dVis;

		return mut3dVis.isVisible();
	},
	/**
	 * Focuses the 3D visualizer on the residue
	 * corresponding to the given pileup of mutations.
	 *
	 * If this function is invoked without a parameter,
	 * then resets the focus to the default state.
	 *
	 * @param pileup    Pileup instance
	 * @return {boolean} true if focus successful, false otherwise
	 */
	focusView: function(pileup)
	{
		var self = this;
		var mut3dVis = self.options.mut3dVis;

		if (pileup)
		{
			return mut3dVis.focusOn(pileup);
		}
		else
		{
			mut3dVis.resetFocus();
			return true;
		}
	},
	/**
	 * Highlights the 3D visualizer for the residue
	 * corresponding to the given array of pileups of mutations.
	 *
	 * @param pileups   an array of Pileup instances
	 * @param reset     whether to reset previous highlights
	 * @return {Number} number of mapped residues
	 */
	highlightView: function(pileups, reset)
	{
		var self = this;
		var mut3dVis = self.options.mut3dVis;

		return mut3dVis.highlight(pileups, reset);
	},
	/**
	 * Resets all residue highlights.
	 */
	resetHighlight: function()
	{
		var self = this;
		var mut3dVis = self.options.mut3dVis;

		mut3dVis.resetHighlight();
	},
	/**
	 * Shows the loader image for the 3D vis container.
	 */
	showLoader: function()
	{
		var self = this;
		var loaderImage = self.$el.find(".mutation-3d-vis-loader");
		var container = self.$el.find(".mutation-3d-vis-container");

		// hide actual vis container
		// (jQuery.hide function is problematic with 3D visualizer,
		// instead we are changing height)
		var height = container.css("height");

		if (!(height === 0 || height === "0px"))
		{
			self._actualHeight = height;
			container.css("height", 0);
		}

		// show image
		loaderImage.show();
	},
	/**
	 * Hides the loader image and shows the actual 3D visualizer content.
	 */
	hideLoader: function()
	{
		var self = this;
		var loaderImage = self.$el.find(".mutation-3d-vis-loader");
		var container = self.$el.find(".mutation-3d-vis-container");

		// hide image
		loaderImage.hide();

		// show actual vis container
		container.css("height", self._actualHeight);
	},
	/**
	 * Shows the loader for the entire panel body.
	 */
	showMainLoader: function()
	{
		var self = this;
		var loaderImage = self.$el.find(".mutation-3d-vis-main-loader");
		var mainContent = self.$el.find(".mutation-3d-vis-body");

		// show the image
		loaderImage.show();

		// hide the main body
		mainContent.hide();
	},
	/**
	 * Hides the loader image and shows the main content (panel body).
	 */
	hideMainLoader: function()
	{
		var self = this;
		var loaderImage = self.$el.find(".mutation-3d-vis-main-loader");
		var mainContent = self.$el.find(".mutation-3d-vis-body");

		// show the image
		loaderImage.hide();

		// hide the main body
		mainContent.show();
	},
	/**
	 * Shows a warning message for unmapped residues.
	 *
	 * @param unmappedCount  number of unmapped selections
	 * @param selectCount    total number of selections
	 */
	showResidueWarning: function(unmappedCount, selectCount)
	{
		var self = this;
		var warning = self.$el.find(".mutation-3d-residue-warning");
		var unmapped = self.$el.find(".mutation-3d-unmapped-info");

		// show warning only if no other warning is visible
		if (!self.$el.find(".mutation-3d-nomap-warning").is(":visible"))
		{
			if (selectCount > 1)
			{
				unmapped.text(unmappedCount + " of the selections");
			}
			else
			{
				unmapped.text("Selected mutation");
			}

			warning.show();
		}
	},
	/**
	 * Hides the residue warning message.
	 */
	hideResidueWarning: function()
	{
		var self = this;
		var warning = self.$el.find(".mutation-3d-residue-warning");

		warning.hide();
	},
	/**
	 * Shows a warning message for unmapped residues.
	 */
	showNoMapWarning: function()
	{
		var self = this;
		var warning = self.$el.find(".mutation-3d-nomap-warning");

		warning.show();
	},
	/**
	 * Hides the residue warning message.
	 */
	hideNoMapWarning: function()
	{
		var self = this;
		var warning = self.$el.find(".mutation-3d-nomap-warning");

		warning.hide();
	}
});

module.exports = Mutation3dVisView;