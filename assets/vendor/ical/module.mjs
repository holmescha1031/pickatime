/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch */

import Binary from "./binary.mjs";
import Component from "./component.mjs";
import ComponentParser from "./component_parser.mjs";
import design from "./design.mjs";
import Duration from "./duration.mjs";
import Event from "./event.mjs";
import * as helpers from "./helpers.mjs";
import parse from "./parse.mjs";
import Period from "./period.mjs";
import Property from "./property.mjs";
import Recur from "./recur.mjs";
import RecurExpansion from "./recur_expansion.mjs";
import RecurIterator from "./recur_iterator.mjs";
import stringify from "./stringify.mjs";
import Time from "./time.mjs";
import Timezone from "./timezone.mjs";
import TimezoneService from "./timezone_service.mjs";
import UtcOffset from "./utc_offset.mjs";
import VCardTime from "./vcard_time.mjs";

/**
 * The main ICAL module. Provides access to everything else.
 *
 * @alias ICAL
 * @namespace ICAL
 * @property {ICAL.design} design
 * @property {ICAL.helpers} helpers
 */
export default {
  /**
   * The number of characters before iCalendar line folding should occur
   * @type {Number}
   * @default 75
   */
  foldLength: 75,

  debug: false,

  /**
   * The character(s) to be used for a newline. The default value is provided by
   * rfc5545.
   * @type {String}
   * @default "\r\n"
   */
  newLineChar: '\r\n',

  Binary,
  Component,
  ComponentParser,
  Duration,
  Event,
  Period,
  Property,
  Recur,
  RecurExpansion,
  RecurIterator,
  Time,
  Timezone,
  TimezoneService,
  UtcOffset,
  VCardTime,

  parse,
  stringify,

  design,
  helpers
};
