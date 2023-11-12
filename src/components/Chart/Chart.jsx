"use client";

/**
 * Reference about using update() vs setData(): https://www.highcharts.com/forum/viewtopic.php?p=121273&sid=364c3658bf0206151090442e4c8b79a6#p121273
 */

import React from "react";
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";
import { numCompact, n } from "@/helpers";

export default function Chart({
  data,
  options: extraOptions = {},
  callback = (chart) => { },
}) {
  const chartRef = React.useRef(null);
  const [options, setOptions] = React.useState(
    Object.assign({}, DEFAULT_OPTIONS, extraOptions)
  );

  React.useEffect(() => {
    if (!chartRef.current) return;
    if (!data) return;

    if (data.length > 0) {
      for (let i = 0; i < data.length; i++) {
        if (chartRef.current.chart.series[i]) {
          chartRef.current.chart.series[i].setData(data[i]);
        } else {
          chartRef.current.chart.addSeries({ data: data[i] });
        }
      }
    } else {
      chartRef.current.chart.series[0].setData(data);
    }
  }, [data]);

  return (
    <div>
      <HighchartsReact
        ref={chartRef}
        highcharts={Highcharts}
        constructorType={"stockChart"}
        options={options}
        callback={callback}
      />
    </div>
  );
}

const DEFAULT_OPTIONS = {
  accessibility: {
    enabled: false,
  },
  credits: {
    enabled: false,
  },
  legend: {
    enabled: true,
    itemStyle: {
      color: '#606367',
      fontWeight: 'bold',
      fontSize: '13px'
    },
    itemHoverStyle: {
      color: '#606367'
    },
    itemHiddenStyle: {
      color: '#333333'
    },
    backgroundColor: '#FAFAFA', // grey background
    borderRadius: '1rem',
    symbolHeight: 4,
    itemMarginTop: 5,
    itemMarginBottom: 5,
    itemMarginLeft: 15,
    itemMarginRight: 15,
    y: 50,
  },
  chart: {
    spacing: [0, 0, 50, 0],
    backgroundColor: "transparent",
  },
  rangeSelector: {
    enabled: false,
  },
  navigator: { enabled: false },
  scrollbar: { enabled: false },
  annotations: [],
  tooltip: {
    borderRadius: 5,
    borderWidth: 0,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    shadow: {
      color: 'rgba(107, 117, 128, 0.50)',
      offsetX: 0,
      offsetY: 1,
      opacity: 0.5,
      width: 4
    },
    style: {
      color: "#615C70",
      fontSize: "14px",
      fontWeight: "normal",
    },
    shared: true,
    useHTML: true,
    formatter: function () {
      return `
        <div style="font-family:Roboto,Arial,sans-serif;font-size: 16px;text-align:center;line-height:1.5;color:#606367;font-weight:600;">${Highcharts.dateFormat('%b %e, %Y', this.x)}</div>
        ${this.points.map(point => `
          <div style="font-size:14px;display:flex;align-items:baseline;margin:.75rem 0 .5rem 0;color:#606367;">
            <div style="display:flex;align-items:center;">
              <svg height="10" width="10" style="margin-right:.5rem;">
                <circle cx="5" cy="5" r="5" fill="${point.color}" />
              </svg>
              <b>${point.series.name}</b>
            </div>
            <div style="background:repeating-linear-gradient(to right, #dedede, #dedede 2px, transparent 2px, transparent 5px);flex:1;min-width:1rem;position:relative;height:2px;margin:0 .2rem;"></div>
            <span>${n(point.y)}</span>
          </div>
        `).join('')}
      `;
    }
  },
  xAxis: {
    lineWidth: 0,
    tickColor: "#606367",
    lineColor: "#F3F4F5",
    gridLineWidth: 0,
    tickWidth: 3,
    tickPositioner: function () {
      const NUM_TICKS = 3;

      var positions = [],
        dataMin = this.dataMin,
        dataMax = this.dataMax,
        interval = (dataMax - dataMin) / NUM_TICKS;

      // calculate positions by dividing the range into equal parts
      for (var i = 0; i < NUM_TICKS; i++) {
        positions.push(dataMin + interval / 2 + i * interval);
      }

      return positions;
    },
    labels: {
      formatter: function () {
        return Highcharts.dateFormat('%b %e', this.value);
      },
      align: 'center',
      style: {
        fontSize: 15, // px
        color: "#606367",
      },
    },
  },
  yAxis: {
    opposite: false,
    gridLineColor: "#F3F4F5",
    tickWidth: 0,
    gridLineWidth: 1,
    labels: {
      formatter: function () {
        return '$' + numCompact(this.value, 0)
      },
      y: 6,
      style: {
        fontSize: 15, // px
        color: "#606367",
      },
    },
  },
};