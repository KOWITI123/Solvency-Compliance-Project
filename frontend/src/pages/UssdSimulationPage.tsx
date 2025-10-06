import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Smartphone, ArrowLeft } from 'lucide-react';
const ussdScreens: Record<string, { title: string; options: string[]; handler: (option: string) => string }> = {
  '': {
    title: 'Welcome to SolvaSure\nSelect an option:',
    options: ['1. Input Data', '2. Check Status'],
    handler: (option) => (option === '1' ? 'inputCapital' : option === '2' ? 'checkStatus' : ''),
  },
  inputCapital: {
    title: 'Enter Capital (KES):',
    options: [],
    handler: () => 'inputLiabilities',
  },
  inputLiabilities: {
    title: 'Enter Liabilities (KES):',
    options: [],
    handler: () => 'submitSuccess',
  },
  submitSuccess: {
    title: 'Thank you. Your data has been submitted successfully.',
    options: ['0. Back to Main Menu'],
    handler: () => '',
  },
  checkStatus: {
    title: 'Your current status is: COMPLIANT.\nSolvency Ratio: 1.25',
    options: ['0. Back to Main Menu'],
    handler: () => '',
  },
};
export function UssdSimulationPage() {
  const [currentScreen, setCurrentScreen] = useState('');
  const [inputValue, setInputValue] = useState('');
  const screen = ussdScreens[currentScreen];
  const handleSend = () => {
    const nextScreen = screen.handler(inputValue);
    setCurrentScreen(nextScreen);
    setInputValue('');
  };
  const handleBack = () => {
    // This is a simplified back logic for demo purposes
    if (currentScreen === 'submitSuccess' || currentScreen === 'checkStatus') {
      setCurrentScreen('');
    } else if (currentScreen === 'inputLiabilities') {
      setCurrentScreen('inputCapital');
    } else if (currentScreen === 'inputCapital') {
      setCurrentScreen('');
    }
  };
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">USSD Simulation</h1>
        <p className="text-lg text-muted-foreground">
          A visual demonstration of the USSD-based interaction flow.
        </p>
      </div>
      <div className="flex justify-center">
        <Card className="w-full max-w-sm shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between bg-muted p-4">
            <div className="flex items-center gap-2">
              <Smartphone className="h-6 w-6" />
              <CardTitle className="text-lg">USSD Service</CardTitle>
            </div>
            {currentScreen !== '' && (
              <Button variant="ghost" size="icon" onClick={handleBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-6 min-h-[200px] flex flex-col justify-center">
            <pre className="text-sm whitespace-pre-wrap font-sans">{screen.title}</pre>
            <ul className="mt-2 space-y-1">
              {screen.options.map((opt) => (
                <li key={opt} className="text-sm">{opt}</li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 bg-muted p-4">
            <Input
              placeholder="Enter option or value..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <div className="flex w-full justify-end gap-2">
              <Button variant="outline" onClick={() => setInputValue('')}>Cancel</Button>
              <Button onClick={handleSend}>Send</Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}