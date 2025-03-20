import "@/global.css";
import optionsStorage from "@/options-storage";
import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

export default function OptionsPage() {
  const [colors, setColors] = useState({
    colorRed: "0",
    colorGreen: "0",
    colorBlue: "0",
  });
  const [text, setText] = useState("");

  useEffect(() => {
    optionsStorage.getAll().then((options) => {
      setColors({
        colorRed: options.colorRed?.toString() || "0",
        colorGreen: options.colorGreen?.toString() || "0",
        colorBlue: options.colorBlue?.toString() || "0",
      });
      setText(options.text || "");
    });
  }, []);

  useEffect(() => {
    optionsStorage.set({
      colorRed: Number(colors.colorRed),
      colorGreen: Number(colors.colorGreen),
      colorBlue: Number(colors.colorBlue),
    });
  }, [colors]);

  useEffect(() => {
    optionsStorage.set({ text });
  }, [text]);

  const handleColorChange =
    (color: keyof typeof colors) => (value: number[]) => {
      setColors((prev) => ({ ...prev, [color]: value[0].toString() }));
    };

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <div className="space-y-0.5">
        <h1 className="text-2xl font-bold tracking-tight">Extension Options</h1>
      </div>
      <div
        data-orientation="horizontal"
        role="none"
        className="my-6 h-px w-full shrink-0 bg-border"
      ></div>
      <form id="options-form" className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Color Picker</h3>
          <div className="space-y-4">
            {(["Red", "Green", "Blue"] as const).map((color) => (
              <div key={color} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{color}</Label>
                  <Input
                    type="number"
                    name={`color${color}`}
                    min="0"
                    max="255"
                    className="w-20"
                    value={colors[`color${color}` as keyof typeof colors]}
                    onChange={(e) =>
                      setColors((prev) => ({
                        ...prev,
                        [`color${color}`]: e.target.value,
                      }))
                    }
                  />
                </div>
                <Slider
                  min={0}
                  max={255}
                  step={1}
                  value={[
                    Number(colors[`color${color}` as keyof typeof colors]),
                  ]}
                  onValueChange={handleColorChange(
                    `color${color}` as keyof typeof colors,
                  )}
                />
              </div>
            ))}
            <div
              className="mt-4 h-20 w-full rounded-md"
              style={{
                backgroundColor: `rgb(${colors.colorRed}, ${colors.colorGreen}, ${colors.colorBlue})`,
              }}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Notice Content</h3>
          <div className="space-y-2">
            <Label htmlFor="notice-text">Text</Label>
            <Input
              id="notice-text"
              type="text"
              name="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
