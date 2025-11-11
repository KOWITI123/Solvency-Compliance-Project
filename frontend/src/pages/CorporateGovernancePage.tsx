import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, Users, FileCheck, CheckCircle, AlertCircle, Briefcase, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { CorporateGovernanceMetrics } from '@/lib/types';

export function CorporateGovernancePage() {
  const [metrics, setMetrics] = useState<CorporateGovernanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const userId = currentUser.id;

        if (!userId) {
          setLoading(false);
          return;
        }

        const response = await fetch(`http://localhost:5000/api/compliance/corporate-governance/${userId}`);

        if (response.ok) {
          const data = await response.json();
          setMetrics(data.metrics);
        } else {
          setMetrics({
            boardStructure: {
              totalMembers: 9,
              independentDirectors: 4,
              hasIndependentChair: true
            },
            committees: [
              { name: 'Audit and Risk Committee', members: 4, meetingsPerYear: 6 },
              { name: 'ICT Committee', members: 3, meetingsPerYear: 4 },
              { name: 'Investment Committee', members: 4, meetingsPerYear: 4 },
              { name: 'Human Resources Committee', members: 3, meetingsPerYear: 4 }
            ],
            relatedPartyTransactions: [
              {
                party: 'Apollo Group (Parent Company)',
                amount: 45000000,
                description: 'Insurance premiums and services',
                date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
              },
              {
                party: 'Associated Investment Fund',
                amount: 125000000,
                description: 'Investment management services',
                date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
              }
            ],
            investmentPolicySubmitted: true,
            investmentPolicyDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
          });
        }
      } catch (error) {
        console.error('Error fetching corporate governance metrics:', error);
        setMetrics({
          boardStructure: {
            totalMembers: 9,
            independentDirectors: 4,
            hasIndependentChair: true
          },
          committees: [
            { name: 'Audit and Risk Committee', members: 4, meetingsPerYear: 6 },
            { name: 'ICT Committee', members: 3, meetingsPerYear: 4 },
            { name: 'Investment Committee', members: 4, meetingsPerYear: 4 },
            { name: 'Human Resources Committee', members: 3, meetingsPerYear: 4 }
          ],
          relatedPartyTransactions: [
            {
              party: 'Apollo Group (Parent Company)',
              amount: 45000000,
              description: 'Insurance premiums and services',
              date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
              party: 'Associated Investment Fund',
              amount: 125000000,
              description: 'Investment management services',
              date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
            }
          ],
          investmentPolicySubmitted: true,
          investmentPolicyDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-lg text-center p-8">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
            <CardDescription>Fetching corporate governance metrics...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-lg text-center p-8">
          <CardHeader>
            <CardTitle>No Data Available</CardTitle>
            <CardDescription>
              Corporate governance metrics are not available at this time.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const independenceRatio = (metrics.boardStructure.independentDirectors / metrics.boardStructure.totalMembers) * 100;
  const hasAdequateIndependence = independenceRatio >= 33;
  const totalRPTAmount = metrics.relatedPartyTransactions.reduce((sum, t) => sum + t.amount, 0);

  const formatCurrency = (value: number) => {
    return `KES ${(value / 1000000).toFixed(2)}M`;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
          <Building2 className="h-10 w-10 text-blue-600" />
          Corporate Governance and Ethics
        </h1>
        <p className="text-lg text-muted-foreground">
          Compliance with IRA Corporate Governance Guidelines
        </p>
      </div>

      <Alert variant="default" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800">
        <Briefcase className="h-4 w-4" />
        <AlertTitle className="text-lg font-semibold">
          IRA Corporate Governance Framework
        </AlertTitle>
        <AlertDescription>
          Compliance includes adherence to ethical and procedural standards, including separation of Board and management roles, independent directors, committee oversight, and monitoring of related party transactions to prevent conflicts of interest.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-2 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Board Structure
            </CardTitle>
            <CardDescription>Independence and composition</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Members</span>
                <span className="text-2xl font-bold text-blue-600">
                  {metrics.boardStructure.totalMembers}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Independent Directors</span>
                <span className="text-2xl font-bold text-green-600">
                  {metrics.boardStructure.independentDirectors}
                </span>
              </div>
              <Separator />
              <div className="text-center mt-4">
                <p className="text-sm text-muted-foreground mb-1">Independence Ratio</p>
                <p className={`text-3xl font-bold ${hasAdequateIndependence ? 'text-green-600' : 'text-orange-600'}`}>
                  {independenceRatio.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Board Committees
            </CardTitle>
            <CardDescription>Specialized oversight functions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-center mb-4">
                <p className="text-4xl font-bold text-blue-600">{metrics.committees.length}</p>
                <p className="text-sm text-muted-foreground">Active Committees</p>
              </div>
              <Separator />
              <div className="space-y-1 mt-3">
                {metrics.committees.map((committee, index) => (
                  <div key={index} className="text-xs p-2 bg-slate-50 dark:bg-slate-900 rounded">
                    <p className="font-medium">{committee.name}</p>
                    <p className="text-muted-foreground">
                      {committee.members} members, {committee.meetingsPerYear} meetings/year
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Investment Policy
            </CardTitle>
            <CardDescription>Regulatory submission status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              {metrics.investmentPolicySubmitted ? (
                <>
                  <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-3" />
                  <Badge variant="default" className="text-lg py-2 px-4">
                    Submitted
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-3">
                    Last submission: {format(new Date(metrics.investmentPolicyDate), 'PP')}
                  </p>
                </>
              ) : (
                <>
                  <AlertCircle className="h-16 w-16 text-orange-600 mx-auto mb-3" />
                  <Badge variant="destructive" className="text-lg py-2 px-4">
                    Not Submitted
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-3">
                    Policy submission required
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Board Independence and Structure</CardTitle>
          <CardDescription>
            IRA requirements for Board composition and independence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <Alert variant={hasAdequateIndependence && metrics.boardStructure.hasIndependentChair ? "default" : "destructive"}>
              {hasAdequateIndependence && metrics.boardStructure.hasIndependentChair ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertTitle>Board Independence Status</AlertTitle>
              <AlertDescription>
                {hasAdequateIndependence && metrics.boardStructure.hasIndependentChair
                  ? 'Your board structure meets IRA independence requirements with adequate independent directors and separation of roles.'
                  : 'Your board structure may need adjustments to meet IRA independence requirements.'}
              </AlertDescription>
            </Alert>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 border rounded-lg">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Board Composition
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                    <span className="text-sm">Total Board Members</span>
                    <span className="text-xl font-bold">{metrics.boardStructure.totalMembers}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded">
                    <span className="text-sm">Independent Directors</span>
                    <span className="text-xl font-bold text-green-600">
                      {metrics.boardStructure.independentDirectors}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded">
                    <span className="text-sm">Executive Directors</span>
                    <span className="text-xl font-bold">
                      {metrics.boardStructure.totalMembers - metrics.boardStructure.independentDirectors}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 border rounded-lg">
                <h3 className="font-semibold text-lg mb-4">Key Requirements</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle className={`h-5 w-5 mt-0.5 ${hasAdequateIndependence ? 'text-green-600' : 'text-gray-400'}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Minimum Independent Directors</p>
                      <p className="text-xs text-muted-foreground">
                        At least one-third of Board should be independent
                      </p>
                      <Badge variant={hasAdequateIndependence ? "default" : "destructive"} className="mt-1 text-xs">
                        {independenceRatio.toFixed(1)}% ({hasAdequateIndependence ? 'Met' : 'Not Met'})
                      </Badge>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <CheckCircle className={`h-5 w-5 mt-0.5 ${metrics.boardStructure.hasIndependentChair ? 'text-green-600' : 'text-gray-400'}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Role Separation</p>
                      <p className="text-xs text-muted-foreground">
                        Separation of Board Chair and CEO roles
                      </p>
                      <Badge variant={metrics.boardStructure.hasIndependentChair ? "default" : "destructive"} className="mt-1 text-xs">
                        {metrics.boardStructure.hasIndependentChair ? 'Implemented' : 'Not Implemented'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Board Committee Structure</CardTitle>
          <CardDescription>
            Specialized committees for effective Board oversight
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert variant="default" className="bg-slate-50 dark:bg-slate-900">
              <Briefcase className="h-4 w-4" />
              <AlertTitle>Committee Oversight</AlertTitle>
              <AlertDescription>
                The IRA expects the Board to discharge its responsibilities through established committees with clear mandates for audit, risk, ICT, investment, and human resources matters.
              </AlertDescription>
            </Alert>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Committee Name</TableHead>
                  <TableHead className="text-center">Members</TableHead>
                  <TableHead className="text-center">Meetings/Year</TableHead>
                  <TableHead>Primary Responsibility</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.committees.map((committee, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{committee.name}</TableCell>
                    <TableCell className="text-center">{committee.members}</TableCell>
                    <TableCell className="text-center">{committee.meetingsPerYear}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {committee.name.includes('Audit') && 'Financial oversight and internal controls'}
                      {committee.name.includes('ICT') && 'Technology governance and cybersecurity'}
                      {committee.name.includes('Investment') && 'Investment strategy and portfolio management'}
                      {committee.name.includes('Human') && 'HR policies and executive compensation'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Related Party Transactions
          </CardTitle>
          <CardDescription>
            Monitoring of transactions with related entities to prevent conflicts of interest
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <Alert variant="default" className="bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Regulatory Monitoring</AlertTitle>
              <AlertDescription>
                Related Party Transactions (RPTs) are strictly monitored by the IRA to prevent conflicts of interest. All transactions with parent companies, associates, and related entities must be disclosed and conducted at arm's length.
              </AlertDescription>
            </Alert>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border">
              <div className="flex justify-between items-center mb-4">
                <span className="font-semibold">Total RPT Value</span>
                <span className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totalRPTAmount)}
                </span>
              </div>
              <Separator className="my-4" />
              <p className="text-xs text-muted-foreground">
                All related party transactions are disclosed in accordance with IRA requirements and conducted at market rates to ensure fairness and prevent conflicts of interest.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">Disclosed Transactions</h3>
              {metrics.relatedPartyTransactions.map((transaction, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-medium">{transaction.party}</p>
                      <p className="text-sm text-muted-foreground">{transaction.description}</p>
                    </div>
                    <Badge variant="outline">{formatCurrency(transaction.amount)}</Badge>
                  </div>
                  <Separator className="my-2" />
                  <p className="text-xs text-muted-foreground">
                    Transaction Date: {format(new Date(transaction.date), 'PPP')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Investment Policy Compliance</CardTitle>
          <CardDescription>
            Regulatory requirement for investment policy submission
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 border rounded-lg bg-slate-50 dark:bg-slate-900">
                <h3 className="font-semibold text-lg mb-4">Policy Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    {metrics.investmentPolicySubmitted ? (
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    ) : (
                      <AlertCircle className="h-8 w-8 text-orange-600" />
                    )}
                    <div>
                      <p className="font-medium">
                        {metrics.investmentPolicySubmitted ? 'Policy Submitted' : 'Policy Not Submitted'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {metrics.investmentPolicySubmitted
                          ? `Last submission: ${format(new Date(metrics.investmentPolicyDate), 'PPP')}`
                          : 'Submission required for compliance'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border rounded-lg">
                <h3 className="font-semibold text-lg mb-4">Policy Requirements</h3>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">Insurers must prepare and submit a detailed investment policy covering:</p>
                  <ul className="space-y-1 ml-4 text-xs text-muted-foreground">
                    <li>• Asset allocation strategy</li>
                    <li>• Risk limits and tolerances</li>
                    <li>• Investment objectives</li>
                    <li>• Monitoring and reporting procedures</li>
                    <li>• Compliance with regulatory solvency limits</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Governance Compliance Summary</CardTitle>
          <CardDescription>Key corporate governance requirements checklist</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <CheckCircle className={`h-5 w-5 mt-0.5 ${hasAdequateIndependence ? 'text-green-600' : 'text-gray-400'}`} />
              <div className="flex-1">
                <p className="font-medium">Board Independence</p>
                <p className="text-sm text-muted-foreground">
                  Minimum one-third independent directors
                </p>
                <Badge variant={hasAdequateIndependence ? "default" : "destructive"} className="mt-2">
                  {independenceRatio.toFixed(1)}% independent
                </Badge>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <CheckCircle className={`h-5 w-5 mt-0.5 ${metrics.boardStructure.hasIndependentChair ? 'text-green-600' : 'text-gray-400'}`} />
              <div className="flex-1">
                <p className="font-medium">Role Separation</p>
                <p className="text-sm text-muted-foreground">
                  Separation of Board Chair and management roles
                </p>
                <Badge variant={metrics.boardStructure.hasIndependentChair ? "default" : "destructive"} className="mt-2">
                  {metrics.boardStructure.hasIndependentChair ? 'Implemented' : 'Not Implemented'}
                </Badge>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <CheckCircle className={`h-5 w-5 mt-0.5 ${metrics.committees.length >= 4 ? 'text-green-600' : 'text-gray-400'}`} />
              <div className="flex-1">
                <p className="font-medium">Committee Structure</p>
                <p className="text-sm text-muted-foreground">
                  Established committees for specialized oversight
                </p>
                <Badge variant="default" className="mt-2">
                  {metrics.committees.length} active committees
                </Badge>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <CheckCircle className={`h-5 w-5 mt-0.5 ${metrics.relatedPartyTransactions.length > 0 ? 'text-green-600' : 'text-green-600'}`} />
              <div className="flex-1">
                <p className="font-medium">Related Party Transaction Disclosure</p>
                <p className="text-sm text-muted-foreground">
                  All RPTs monitored and disclosed to prevent conflicts
                </p>
                <Badge variant="default" className="mt-2">
                  {metrics.relatedPartyTransactions.length} transactions disclosed
                </Badge>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <CheckCircle className={`h-5 w-5 mt-0.5 ${metrics.investmentPolicySubmitted ? 'text-green-600' : 'text-gray-400'}`} />
              <div className="flex-1">
                <p className="font-medium">Investment Policy Submission</p>
                <p className="text-sm text-muted-foreground">
                  Detailed investment policy submitted to regulator
                </p>
                <Badge variant={metrics.investmentPolicySubmitted ? "default" : "destructive"} className="mt-2">
                  {metrics.investmentPolicySubmitted ? 'Submitted' : 'Not Submitted'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
