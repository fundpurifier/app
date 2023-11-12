import { Chart } from "react-google-charts";
import chroma from "chroma-js";
import { n } from '@/helpers'

type PieData = {
    name: string;
    y: number;
}[]

export default function PieChart({ data }: { data: PieData }) {
    const transformedData = [['Fund', 'Market Value'], ...data.map(item => [squeeze(item.name), item.y])];
    const pieOptions = {
        title: "",
        slices: [
            ...Array(data.length).fill(null).map((_, index) => ({
                color: chroma.scale(['#2BB673', '#d91e48', '#007fad', '#e9a227']).mode('lch').colors(data.length)[index]
            }))
        ],

        tooltip: {
            text: 'value',
            formatter: (cellValue: number): string => {
                return n(cellValue);
            }
        },
        sliceVisibilityThreshold: 0.15,
        chartArea: {
            width: "90%",
            height: "90%"
        },
    };

    return (
        <div className="py-4">
            <Chart
                chartType="PieChart"
                data={transformedData}
                options={pieOptions}
            />
        </div>
    );
}

function squeeze(title: string) {
    // Remove the "Filtered " prefix from the title
    return title.replace('Filtered ', '')
}