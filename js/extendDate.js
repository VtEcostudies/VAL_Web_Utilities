/*
    Extend js Date object with missing features. Js Dates include, 'getYear', 'getMonth'
    but not 'getWeek'.

    Just import this module like: import './extendDate.js'
*/

/*
    For an instantiated Date object, which *must* be created like dt = new Date(), getWeek()
    returns the numeric week of the year, 0-based.

    NOTE that there are indeed 53 'weeks' in a year. 52*7=364. The 365th (or 366th) day is 
    the 53rd week.
*/
Date.prototype.getWeek = function () {
    var dt = new Date(this.getFullYear(), 0, 1);
    let millisecondOfYear = this - dt;
    let millisecondPerDay = 86400000;
    let dayOfYear = Math.ceil(millisecondOfYear / millisecondPerDay);
    let weekOfYear = Math.floor(dayOfYear / 7);
    return weekOfYear;
};

Date.prototype.getDOY = function () {
    var then = new Date(this);
    var start = new Date(then.getFullYear(), 0, 0);
    var diff = (then - start) + ((start.getTimezoneOffset() - then.getTimezoneOffset()) * 60 * 1000);
    var oneDay = 1000 * 60 * 60 * 24;
    var doy = Math.floor(diff / oneDay);
    //console.log('Day of year: ' + doy);
    return doy;
}

/*
    For an instantiated Date object, which *must* be created like dt = new Date(),
    toUtc() returns a Date object whose millisecond value has been *shifted* to 
    account for the automatic time and date adjustment made by native Date functions.

    It is a stunning oversight that the js Date object doesn't handle this already:

        "Give me the UTC DateTime for an ISO UTC date in milliseconds"

    But it does not. Instead, when we instantiate a Date object with eg. 

        "2023-01-01T00:00:00.000Z"
    
    dates use our local time zone to offset the time of the above date, which in EDT
    means shifting the time back 4 or 5 hours, which means changing the date from
    2023-01-01 to 2022-12-31. There isn't an option to consistently ignore local TZ 
    and treat all timestamps as UTC.

    To resolve this conundrum, we have to alter the millisecond timestamp by shifting
    it by the local timezone offset so js Date functions shift it back to where it 
    ought to be.
*/
Date.prototype.toUtc = function() {
    let tz = this.getTimezoneOffset();
    let ut = new Date(this.setMinutes(this.getMinutes()+parseInt(tz)));
    return ut;
}
